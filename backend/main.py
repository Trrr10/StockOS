"""
StockOS — FastAPI Backend v2.3.1
Voice fix: strip codec suffix from MIME before sending to Sarvam STT
"""

from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any
import os, json, re, httpx, base64
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client
from groq import Groq

load_dotenv()

app = FastAPI(title="StockOS API", version="2.3.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", "*"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL         = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GROQ_API_KEY         = os.getenv("GROQ_API_KEY")
SARVAM_API_KEY       = os.getenv("SARVAM_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY must be set in .env")
if not SARVAM_API_KEY:
    raise RuntimeError("SARVAM_API_KEY must be set in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
groq_client      = Groq(api_key=GROQ_API_KEY)

_forecast_cache = {"data": None, "expires": None}
_anomaly_cache  = {"data": None, "expires": None}

SARVAM_MIME_MAP = {
    "audio/webm":  ("audio/webm",  "webm"),
    "audio/ogg":   ("audio/ogg",   "ogg"),
    "audio/opus":  ("audio/ogg",   "ogg"),
    "audio/mp4":   ("audio/mp4",   "mp4"),
    "audio/mpeg":  ("audio/mpeg",  "mp3"),
    "audio/mp3":   ("audio/mpeg",  "mp3"),
    "audio/wav":   ("audio/wav",   "wav"),
    "audio/wave":  ("audio/wav",   "wav"),
    "audio/x-wav": ("audio/wav",   "wav"),
    "audio/flac":  ("audio/flac",  "flac"),
    "audio/x-flac":("audio/flac",  "flac"),
    "audio/aac":   ("audio/aac",   "aac"),
    "audio/x-aac": ("audio/aac",   "aac"),
    "audio/amr":   ("audio/amr",   "amr"),
    "audio/x-m4a": ("audio/mp4",   "m4a"),
    "application/octet-stream": ("audio/webm", "webm"),
}


# ─── Auth ─────────────────────────────────────────────────────────────────────

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ")[1]
    try:
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")


# ─── Models ───────────────────────────────────────────────────────────────────

class StockAdjustment(BaseModel):
    product_id: str
    type: str
    quantity: int
    reason: str
    notes: Optional[str] = ""
    adjustment_type: Optional[str] = "manual"

class BarcodeUpdate(BaseModel):
    barcode: str
    type: str
    quantity: int
    reason: str
    notes: Optional[str] = ""

class BatchAdjustmentItem(BaseModel):
    product_id: str
    type: str
    quantity: int
    reason: str

class BatchAdjustment(BaseModel):
    items: List[BatchAdjustmentItem]

class AIQuery(BaseModel):
    query: str
    context: Optional[str] = "inventory"
    products: Optional[List[Any]] = None

class VoiceParseRequest(BaseModel):
    transcript: str
    language_code: Optional[str] = "hi-IN"

class ReorderSuggestionsRequest(BaseModel):
    products: Optional[List[Any]] = None
    context: Optional[str] = "inventory_manager"

class CommitStock(BaseModel):
    order_id: str

class ProductCreate(BaseModel):
    product_code: str
    name: str
    description: Optional[str] = ""
    category: str
    unit: Optional[str] = "units"
    unit_price: float
    quantity: int = 0
    reorder_threshold: int = 10
    preferred_supplier: Optional[str] = None
    barcode: Optional[str] = None

class NotificationRead(BaseModel):
    notification_ids: List[str]

class AnonymousReport(BaseModel):
    category: str
    description: str
    severity: Optional[str] = None
    location_detail: Optional[str] = None

class ChatMessage(BaseModel):
    group_name: str
    content: str
    mentions: Optional[List[str]] = []

class TTSRequest(BaseModel):
    text: str
    language_code: Optional[str] = "en-IN"
    speaker: Optional[str] = "anushka"


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "stockos-api", "version": "2.3.1"}


# ─── Products ─────────────────────────────────────────────────────────────────

@app.get("/api/products")
async def get_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(get_current_user)
):
    query = supabase.table("products").select(
        "*, suppliers(name, credibility_score, lead_time_days)"
    )
    if category and category != "All":
        query = query.eq("category", category)
    if search:
        query = query.or_(f"name.ilike.%{search}%,product_code.ilike.%{search}%")
    return query.order("name").execute().data or []


@app.get("/api/products/{product_id}")
async def get_product(product_id: str, user=Depends(get_current_user)):
    result = supabase.table("products").select(
        "*, suppliers(name, credibility_score, contact_email, lead_time_days)"
    ).eq("id", product_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Product not found")
    return result.data


@app.post("/api/products")
async def create_product(payload: ProductCreate, user=Depends(get_current_user)):
    result = supabase.table("products").insert(payload.dict()).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create product")
    _log_audit(supabase, "create_product", "product", result.data[0]["id"],
               str(user.id), {"name": payload.name})
    return result.data[0]


@app.put("/api/products/{product_id}")
async def update_product(product_id: str, payload: dict, user=Depends(get_current_user)):
    payload.pop("id", None)
    result = supabase.table("products").update(payload).eq("id", product_id).execute()
    return result.data[0] if result.data else {}


@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    supabase.table("products").delete().eq("id", product_id).execute()
    return {"success": True}


# ─── Stock Adjustments ────────────────────────────────────────────────────────

@app.post("/api/stock/adjust")
async def adjust_stock(adj: StockAdjustment, user=Depends(get_current_user)):
    product_res = supabase.table("products").select(
        "id, name, quantity, reorder_threshold"
    ).eq("id", adj.product_id).single().execute()

    if not product_res.data:
        raise HTTPException(status_code=404, detail="Product not found")

    p          = product_res.data
    qty_before = p["quantity"] or 0

    if adj.type == "in":
        qty_after = qty_before + adj.quantity
    elif adj.type == "out":
        if adj.quantity > qty_before:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock. Available: {qty_before}"
            )
        qty_after = qty_before - adj.quantity
    else:
        raise HTTPException(status_code=400, detail="type must be 'in' or 'out'")

    supabase.table("products").update(
        {"quantity": qty_after}
    ).eq("id", adj.product_id).execute()

    supabase.table("stock_movements").insert({
        "product_id":      adj.product_id,
        "user_id":         str(user.id),
        "type":            adj.type,
        "quantity":        adj.quantity,
        "quantity_before": qty_before,
        "quantity_after":  qty_after,
        "reason":          adj.reason,
        "notes":           adj.notes or "",
        "adjustment_type": adj.adjustment_type or "manual",
    }).execute()

    _log_audit(supabase, "stock_adjustment", "product", adj.product_id, str(user.id), {
        "product_name":    p["name"],
        "type":            adj.type,
        "quantity":        adj.quantity,
        "quantity_before": qty_before,
        "quantity_after":  qty_after,
        "reason":          adj.reason,
    })

    return {
        "success":         True,
        "product_name":    p["name"],
        "quantity_before": qty_before,
        "quantity_after":  qty_after,
        "below_threshold": qty_after < p["reorder_threshold"],
    }


@app.post("/api/stock/barcode")
async def update_by_barcode(update: BarcodeUpdate, user=Depends(get_current_user)):
    product_res = supabase.table("products").select("*").eq(
        "barcode", update.barcode
    ).single().execute()
    if not product_res.data:
        raise HTTPException(status_code=404, detail=f"No product for barcode: {update.barcode}")
    p   = product_res.data
    adj = StockAdjustment(
        product_id=p["id"], type=update.type, quantity=update.quantity,
        reason=update.reason, notes=update.notes, adjustment_type="barcode_scan"
    )
    return {**await adjust_stock(adj, user), "product": p}


@app.post("/api/stock/batch")
async def batch_adjust(batch: BatchAdjustment, user=Depends(get_current_user)):
    results = []
    for item in batch.items:
        try:
            adj = StockAdjustment(
                product_id=item.product_id, type=item.type,
                quantity=item.quantity, reason=item.reason,
                adjustment_type="batch_update"
            )
            results.append({"success": True, **await adjust_stock(adj, user)})
        except HTTPException as e:
            results.append({"success": False, "product_id": item.product_id, "error": e.detail})
    return results


# ─── Stock Commit ─────────────────────────────────────────────────────────────

@app.post("/api/stock/commit")
async def commit_stock(body: CommitStock, user=Depends(get_current_user)):
    order_res = supabase.table("sales_orders").select(
        "*, sales_order_items(product_id, quantity, products(quantity, quantity_reserved, name))"
    ).eq("id", body.order_id).single().execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Order not found")

    items     = order_res.data.get("sales_order_items", [])
    conflicts = []
    for item in items:
        prod      = item.get("products", {})
        available = (prod.get("quantity") or 0) - (prod.get("quantity_reserved") or 0)
        if available < item["quantity"]:
            conflicts.append({
                "product_name": prod.get("name"),
                "required":     item["quantity"],
                "available":    available
            })

    if conflicts:
        supabase.table("sales_orders").update(
            {"status": "stock_conflict"}
        ).eq("id", body.order_id).execute()
        raise HTTPException(
            status_code=409,
            detail={"message": "Insufficient stock", "conflicts": conflicts}
        )

    for item in items:
        prod         = item["products"]
        new_reserved = (prod.get("quantity_reserved") or 0) + item["quantity"]
        supabase.table("products").update(
            {"quantity_reserved": new_reserved}
        ).eq("id", item["product_id"]).execute()

    supabase.table("sales_orders").update({
        "status":       "stock_committed",
        "committed_at": datetime.utcnow().isoformat()
    }).eq("id", body.order_id).execute()

    return {"success": True, "message": "Stock committed and reserved"}


# ─── Movements ────────────────────────────────────────────────────────────────

@app.get("/api/stock/movements")
async def get_movements(
    limit: int = 50,
    product_id: Optional[str] = None,
    user=Depends(get_current_user)
):
    query = supabase.table("stock_movements").select(
        "*, products(name, product_code), profiles(full_name)"
    )
    if product_id:
        query = query.eq("product_id", product_id)
    return query.order("created_at", desc=True).limit(limit).execute().data or []


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

@app.get("/api/inventory/stats")
async def get_inventory_stats(user=Depends(get_current_user)):
    data = supabase.table("products").select(
        "id, quantity, quantity_reserved, unit_price, reorder_threshold, category"
    ).execute().data or []

    total_value = sum((p["quantity"] or 0) * (p["unit_price"] or 0) for p in data)
    below       = [p for p in data if (p["quantity"] or 0) <= p["reorder_threshold"]]
    approaching = [p for p in data
                   if p["reorder_threshold"] < (p["quantity"] or 0) <= p["reorder_threshold"] * 1.5]
    open_sales  = supabase.table("sales_orders").select("id", count="exact").in_(
        "status", ["pending","confirmed","stock_committed","packing"]
    ).execute()
    open_pos    = supabase.table("purchase_orders").select("id", count="exact").in_(
        "status", ["draft","sent","in_transit"]
    ).execute()

    return {
        "total_skus":                len(data),
        "total_value":               round(total_value, 2),
        "below_threshold_count":     len(below),
        "approaching_threshold_count": len(approaching),
        "healthy_count":             len(data) - len(below) - len(approaching),
        "open_sales_orders":         open_sales.count or 0,
        "open_purchase_orders":      open_pos.count or 0,
    }


# ─── Traffic Light ────────────────────────────────────────────────────────────

@app.get("/api/inventory/traffic-light")
async def get_traffic_light(user=Depends(get_current_user)):
    res    = supabase.table("products").select(
        "id, name, product_code, category, quantity, quantity_reserved, "
        "reorder_threshold, unit_price, unit, barcode"
    ).order("name").execute()
    result = []
    for p in (res.data or []):
        qty       = p["quantity"] or 0
        reserved  = p["quantity_reserved"] or 0
        threshold = p["reorder_threshold"] or 1
        available = qty - reserved
        ratio     = available / threshold if threshold > 0 else 1
        result.append({
            **p,
            "available":     available,
            "health_status": "red" if ratio <= 1 else "amber" if ratio <= 1.5 else "green",
            "ratio":         round(ratio, 2)
        })
    return result


# ─── Suppliers ────────────────────────────────────────────────────────────────

@app.get("/api/suppliers")
async def get_suppliers(user=Depends(get_current_user)):
    return supabase.table("suppliers").select("*").eq(
        "is_active", True
    ).order("name").execute().data or []


@app.get("/api/suppliers/{supplier_id}/score")
async def get_supplier_score(supplier_id: str, user=Depends(get_current_user)):
    pos = supabase.table("purchase_orders").select(
        "status, expected_delivery, actual_delivery, "
        "items_ordered, items_received, defect_count"
    ).eq("supplier_id", supplier_id).eq("status", "closed").execute()

    if not pos.data:
        return {"score": 0, "metrics": {"message": "No closed POs yet"}}

    total       = len(pos.data)
    on_time     = sum(1 for p in pos.data
                      if p.get("actual_delivery") and p.get("expected_delivery")
                      and p["actual_delivery"] <= p["expected_delivery"])
    correct_qty = sum(1 for p in pos.data
                      if (p.get("items_received") or 0) >= (p.get("items_ordered") or 0) * 0.95)
    zero_defect = sum(1 for p in pos.data if (p.get("defect_count") or 0) == 0)
    score       = round((on_time/total)*40 + (correct_qty/total)*40 + (zero_defect/total)*20, 1)

    return {
        "score": min(score, 100),
        "metrics": {
            "on_time_rate":       round(on_time/total*100, 1),
            "quantity_accuracy":  round(correct_qty/total*100, 1),
            "defect_free_rate":   round(zero_defect/total*100, 1),
            "total_orders":       total,
        }
    }


# ─── Notifications ────────────────────────────────────────────────────────────

@app.get("/api/notifications")
async def get_notifications(user=Depends(get_current_user)):
    return supabase.table("notifications").select("*").eq(
        "user_id", str(user.id)
    ).order("created_at", desc=True).limit(20).execute().data or []


@app.post("/api/notifications/read")
async def mark_read(body: NotificationRead, user=Depends(get_current_user)):
    supabase.table("notifications").update({"is_read": True}).in_(
        "id", body.notification_ids
    ).eq("user_id", str(user.id)).execute()
    return {"success": True}


# ─── Voice: STT via Sarvam ────────────────────────────────────────────────────

@app.post("/api/voice/stt")
async def voice_stt(
    file: UploadFile = File(...),
    language_code: str = Form(default="en-IN"),
    user=Depends(get_current_user),
):
    audio_bytes = await file.read()
    if len(audio_bytes) < 3000:
        raise HTTPException(
            status_code=400,
            detail="Audio too short — speak longer and clearly"
        )

    # Strip codec suffix: "audio/webm;codecs=opus" → "audio/webm"
    raw_mime     = (file.content_type or "audio/webm").split(";")[0].strip().lower()
    sarvam_mime, ext = SARVAM_MIME_MAP.get(raw_mime, ("audio/webm", "webm"))

    # Use clean filename with correct extension
    filename = f"voice.{ext}"

    async with httpx.AsyncClient(timeout=25.0) as client:
        try:
            resp = await client.post(
                "https://api.sarvam.ai/speech-to-text",
                headers={"api-subscription-key": SARVAM_API_KEY},
                files={
                    "file": (filename, audio_bytes, sarvam_mime)
                },
                data={
                    "model":         "saarika:v2.5",
                    "language_code": language_code,
                },
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Sarvam STT error: {e.response.text}"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Sarvam STT unreachable: {str(e)}"
            )

    transcript = resp.json().get("transcript", "").strip()
    if not transcript:
        raise HTTPException(
            status_code=422,
            detail="No speech detected — try speaking more clearly"
        )
    return {"transcript": transcript, "language_code": language_code}


# ─── Voice: TTS via Sarvam ────────────────────────────────────────────────────

@app.post("/api/voice/tts-confirm")
async def voice_tts(body: TTSRequest, user=Depends(get_current_user)):
    text = body.text[:150]

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={
                    "api-subscription-key": SARVAM_API_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "inputs":               [text],
                    "target_language_code": body.language_code,
                    "speaker":              body.speaker,
                    "model":                "bulbul:v2",
                    "enable_preprocessing": True,
                    "speech_sample_rate":   22050,
                },
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Sarvam TTS error: {e.response.text}"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Sarvam TTS unreachable: {str(e)}"
            )

    audios = resp.json().get("audios", [])
    if not audios:
        raise HTTPException(status_code=502, detail="No audio returned from Sarvam TTS")
    return {"audio_b64": audios[0], "format": "wav", "text": text}


# ─── Voice: Stock intent parsing (Groq — used only on stock adjustment page) ──

@app.post("/api/voice/parse-intent")
async def voice_parse_intent(body: VoiceParseRequest, user=Depends(get_current_user)):
    products_res = supabase.table("products").select("name, product_code").execute()
    product_list = ", ".join(p["name"] for p in (products_res.data or []))

    prompt = (
        f'Inventory assistant. User said: "{body.transcript[:120]}"\n'
        f"Products: {product_list}\n"
        "Respond ONLY with JSON:\n"
        '{"type":"in|out","product_name":"matched name or null","quantity":number|null,'
        '"reason":"Purchase Received|Return from Customer|Production Output|'
        'Correction - Undercount|Transfer In|Opening Stock|Sales Order|'
        'Production Input|Wastage / Damage|Correction - Overcount|Transfer Out|'
        'Sample / Testing|Expired / Disposed or null",'
        '"confidence":"high|low"}'
    )
    try:
        completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama3-8b-8192",
            temperature=0.1,
            max_tokens=120,
        )
        raw = completion.choices[0].message.content.strip()
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Could not parse intent")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Intent parsing failed: {str(e)}")


# ─── AI: Reorder Suggestions ─────────────────────────────────────────────────

@app.post("/api/ai/reorder-suggestions")
async def get_reorder_suggestions(body: ReorderSuggestionsRequest):
    products = body.products or supabase.table("products").select(
        "name, quantity, reorder_threshold, preferred_supplier, unit, unit_price"
    ).execute().data or []

    low_stock = [p for p in products
                 if (p.get("quantity") or 0) <= (p.get("reorder_threshold") or 0) * 1.5]
    if not low_stock:
        return {"suggestions": ["All products above reorder threshold. Stock looks healthy! 🟢"]}

    compact = [{
        "name":      p.get("name"),
        "current":   p.get("quantity"),
        "threshold": p.get("reorder_threshold"),
        "supplier":  p.get("preferred_supplier"),
        "unit":      p.get("unit")
    } for p in low_stock]

    try:
        completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content":
                f"Generate 3-5 actionable reorder suggestions for these low-stock products.\n"
                f"Products: {json.dumps(compact)}\n"
                "Return a JSON array of plain English strings. ONLY valid JSON, no markdown."
            }],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=400,
        )
        raw         = completion.choices[0].message.content.strip()
        raw         = re.sub(r'^```json\s*', '', raw)
        raw         = re.sub(r'\s*```$', '', raw)
        suggestions = json.loads(raw)
        if not isinstance(suggestions, list):
            suggestions = [str(suggestions)]
    except Exception:
        suggestions = [
            f"⚠️ {p.get('name')} critically low — reorder from {p.get('preferred_supplier') or 'supplier'}."
            for p in low_stock[:5]
        ]
    return {"suggestions": suggestions}


# ─── AI: Anomaly Detection ────────────────────────────────────────────────────

@app.get("/api/ai/anomalies")
async def detect_anomalies(user=Depends(get_current_user)):
    now = datetime.utcnow()
    if _anomaly_cache["data"] is not None and _anomaly_cache["expires"] > now:
        return _anomaly_cache["data"]

    movements   = supabase.table("stock_movements").select(
        "type, quantity, products(name)"
    ).order("created_at", desc=True).limit(200).execute()
    product_out = {}
    for m in (movements.data or []):
        if m["type"] != "out": continue
        name = (m.get("products") or {}).get("name")
        if name:
            product_out[name] = product_out.get(name, 0) + m["quantity"]

    products = supabase.table("products").select(
        "name, quantity, reorder_threshold, category"
    ).execute()
    compact  = [{
        "n": p["name"],
        "q": p["quantity"] or 0,
        "t": p["reorder_threshold"] or 0,
        "c": product_out.get(p["name"], 0)
    } for p in (products.data or [])]

    try:
        completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content":
                f"Detect inventory anomalies. Flag: critically low stock, unusually high consumption.\n"
                f"Data (n=name,q=stock,t=threshold,c=consumed): {json.dumps(compact)}\n"
                'Return ONLY JSON array (max 6): '
                '[{"type":"critical|warning|info","title":"","description":"","product":"","action":""}]'
            }],
            model="llama3-8b-8192",
            temperature=0.1,
            max_tokens=400,
        )
        raw       = completion.choices[0].message.content.strip()
        raw       = re.sub(r'^```json\s*', '', raw)
        raw       = re.sub(r'\s*```$', '', raw)
        anomalies = json.loads(raw)
        if not isinstance(anomalies, list):
            anomalies = []
    except Exception:
        anomalies = [{
            "type":        "critical",
            "title":       "Below Threshold",
            "description": f"{p['name']}: {p['quantity']} units.",
            "product":     p["name"],
            "action":      f"Reorder {p['name']}"
        } for p in (products.data or [])
          if (p["quantity"] or 0) <= (p["reorder_threshold"] or 0)]

    result = anomalies[:6]
    _anomaly_cache["data"]    = result
    _anomaly_cache["expires"] = now + timedelta(hours=1)
    return result


# ─── AI: Demand Forecast ──────────────────────────────────────────────────────

@app.get("/api/ai/demand-forecast")
async def demand_forecast(user=Depends(get_current_user)):
    now = datetime.utcnow()
    if _forecast_cache["data"] is not None and _forecast_cache["expires"] > now:
        return _forecast_cache["data"]

    since     = (now - timedelta(days=60)).isoformat()
    movements = supabase.table("stock_movements").select(
        "product_id, quantity, created_at, products(name)"
    ).eq("type", "out").gte("created_at", since).execute()
    products  = supabase.table("products").select(
        "id, name, quantity, reorder_threshold"
    ).execute()

    product_data = {}
    for m in (movements.data or []):
        name = (m.get("products") or {}).get("name")
        if not name: continue
        date = datetime.fromisoformat(m["created_at"])
        if name not in product_data:
            product_data[name] = {"total": 0, "first": date, "last": date}
        product_data[name]["total"] += (m["quantity"] or 0)
        product_data[name]["first"]  = min(product_data[name]["first"], date)
        product_data[name]["last"]   = max(product_data[name]["last"],  date)

    summary = []
    for p in (products.data or [])[:30]:
        name  = p["name"]
        data  = product_data.get(name)
        daily = round(
            data["total"] / max(1, (data["last"] - data["first"]).days + 1), 2
        ) if data else 0
        summary.append({
            "n": name,
            "s": p["quantity"] or 0,
            "t": p["reorder_threshold"] or 0,
            "d": daily
        })

    try:
        completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content":
                "Forecast 30-day demand. n=name,s=stock,t=threshold,d=daily_avg.\n"
                f"Products: {json.dumps(summary)}\n"
                'Return ONLY JSON array: '
                '[{"product_name":"","current_stock":0,"daily_avg_consumption":0.0,'
                '"days_until_stockout":0,"forecast_30d_need":0,"confidence":"high|medium|low"}]'
            }],
            model="llama3-8b-8192",
            temperature=0.1,
            max_tokens=600,
        )
        raw       = completion.choices[0].message.content.strip()
        raw       = re.sub(r'^```json\s*', '', raw)
        raw       = re.sub(r'\s*```$', '', raw)
        forecasts = json.loads(raw)
        if not isinstance(forecasts, list):
            forecasts = []
    except Exception:
        forecasts = []

    _forecast_cache["data"]    = forecasts
    _forecast_cache["expires"] = now + timedelta(hours=1)
    return forecasts


# ─── AI: Cache Clear ──────────────────────────────────────────────────────────

@app.post("/api/ai/cache/clear")
async def clear_ai_cache(user=Depends(get_current_user)):
    _forecast_cache["data"] = None
    _forecast_cache["expires"] = None
    _anomaly_cache["data"]  = None
    _anomaly_cache["expires"] = None
    return {"success": True}


# ─── AI: Natural Language Query ───────────────────────────────────────────────

@app.post("/api/ai/query")
async def ai_query(body: AIQuery, user=Depends(get_current_user)):
    try:
        products_res  = supabase.table("products").select(
            "name, product_code, category, quantity, quantity_reserved, "
            "reorder_threshold, unit_price, unit"
        ).execute()
        movements_res = supabase.table("stock_movements").select(
            "type, quantity, reason, created_at, products(name)"
        ).order("created_at", desc=True).limit(30).execute()

        products_data = [{
            "code":      p["product_code"],
            "name":      p["name"],
            "category":  p["category"],
            "on_hand":   p["quantity"],
            "available": (p["quantity"] or 0) - (p["quantity_reserved"] or 0),
            "threshold": p["reorder_threshold"],
            "price":     p["unit_price"],
            "unit":      p["unit"],
            "status":    "CRITICAL" if (p["quantity"] or 0) <= (p["reorder_threshold"] or 0)
                         else "LOW" if (p["quantity"] or 0) <= (p["reorder_threshold"] or 0) * 1.5
                         else "OK"
        } for p in (products_res.data or [])]

        movements_data = [{
            "product": (m.get("products") or {}).get("name", "?"),
            "type":    m["type"],
            "qty":     m["quantity"],
            "reason":  m["reason"],
            "date":    m["created_at"][:10]
        } for m in (movements_res.data or [])]

        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content":
                    f"Expert inventory AI for StockOS. Answer concisely. Bullets start with '• '.\n"
                    f"Role: {body.context}\n"
                    f"INVENTORY: {json.dumps(products_data)}\n"
                    f"MOVEMENTS: {json.dumps(movements_data)}"
                },
                {"role": "user", "content": body.query},
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=800,
        )
        return {
            "response":    completion.choices[0].message.content,
            "tokens_used": completion.usage.total_tokens
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI query failed: {str(e)}")


# ─── Audit ────────────────────────────────────────────────────────────────────

@app.get("/api/audit")
async def get_audit_logs(limit: int = 50, user=Depends(get_current_user)):
    return supabase.table("audit_logs").select(
        "*, profiles(full_name)"
    ).order("created_at", desc=True).limit(limit).execute().data or []


# ─── Anonymous Reports ────────────────────────────────────────────────────────

@app.post("/api/reports/anonymous")
async def submit_anonymous_report(report: AnonymousReport):
    try:
        data = {"category": report.category, "description": report.description}
        if report.severity:        data["severity"]        = report.severity
        if report.location_detail: data["location_detail"] = report.location_detail
        res = supabase.table("anonymous_reports").insert(data).execute()
        return {"success": True, "id": res.data[0]["id"] if res.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")


# ─── Chat ─────────────────────────────────────────────────────────────────────

@app.get("/api/chat/{group_name}")
async def get_chat(group_name: str, user=Depends(get_current_user)):
    res = supabase.table("chat_messages").select(
        "*, profiles(full_name, avatar_url, role)"
    ).eq("group_name", group_name).order("created_at", desc=True).limit(50).execute()
    return list(reversed(res.data or []))


@app.post("/api/chat")
async def send_chat(msg: ChatMessage, user=Depends(get_current_user)):
    res = supabase.table("chat_messages").insert({
        "group_name": msg.group_name,
        "sender_id":  str(user.id),
        "content":    msg.content,
        "mentions":   msg.mentions or [],
    }).execute()
    return res.data[0] if res.data else {}


@app.get("/api/announcements")
async def get_announcements(user=Depends(get_current_user)):
    return supabase.table("announcements").select("*").order(
        "created_at", desc=True
    ).execute().data or []


# ─── Helper ───────────────────────────────────────────────────────────────────

def _log_audit(sb, action, entity_type, entity_id, user_id, details):
    try:
        sb.table("audit_logs").insert({
            "action":      action,
            "entity_type": entity_type,
            "entity_id":   entity_id,
            "user_id":     user_id,
            "details":     details,
        }).execute()
    except Exception as e:
        print(f"Audit log error (non-fatal): {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )