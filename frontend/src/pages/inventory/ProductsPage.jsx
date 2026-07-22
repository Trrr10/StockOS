import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Edit3, Trash2, X, Save, Upload,
  Package, ChevronUp, ChevronDown, Loader, AlertCircle,
  CheckCircle, Eye
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const CATEGORIES = ['Cotton','Cloth','Accessories','Finished Goods','Raw Materials','Other']
const UNITS = ['kg','meters','units','pcs','rolls','boxes','liters','sets']

const emptyForm = {
  product_code:'', name:'', description:'', category:'Cotton',
  weight:'', unit:'units', unit_price:'', reorder_threshold:'',
  preferred_supplier:'', quantity:0,
}

function StatusBadge({ qty, threshold }) {
  const ratio = (qty||0) / Math.max(threshold||1, 1)
  if (ratio > 1.5) return <span className="status-green text-xs px-2 py-0.5 rounded-full font-medium">Healthy</span>
  if (ratio > 1)   return <span className="status-amber text-xs px-2 py-0.5 rounded-full font-medium">Low</span>
  return (
    <span className="status-red text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
      <motion.span animate={{ scale:[1,1.3,1] }} transition={{ duration:1.5, repeat:Infinity }}
        className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
      Critical
    </span>
  )
}

function ProductModal({ product, onClose, onSave }) {
  const [form, setForm]     = useState(product || emptyForm)
  const [saving, setSaving] = useState(false)
  const isEdit = !!product?.id

  function handle(field, value) { setForm(prev => ({ ...prev, [field]: value })) }

  async function handleSave() {
    if (!form.name || !form.product_code) return toast.error('Name and Product Code are required')
    setSaving(true)

    const payload = {
      product_code:      form.product_code,
      name:              form.name,
      description:       form.description || '',
      category:          form.category,
      weight:            parseFloat(form.weight) || null,
      unit:              form.unit,
      unit_price:        parseFloat(form.unit_price) || 0,
      reorder_threshold: parseInt(form.reorder_threshold) || 0,
      preferred_supplier:form.preferred_supplier || null,
      quantity:          parseInt(form.quantity) || 0,
    }

    let error
    if (isEdit) {
      ;({ error } = await supabase.from('products').update(payload).eq('id', product.id))
    } else {
      ;({ error } = await supabase.from('products').insert(payload))
    }

    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(isEdit ? 'Product updated' : 'Product created')
    onSave()
    onClose()
  }

  const fields = [
    { key:'product_code', label:'Product Code *', placeholder:'CTN-001', half:true },
    { key:'category',     label:'Category',       type:'select',          half:true },
    { key:'name',         label:'Product Name *', placeholder:'Premium Cotton Thread' },
    { key:'description',  label:'Description',    placeholder:'Brief description...', multiline:true },
    { key:'unit',         label:'Unit',           type:'unitSelect',      third:true },
    { key:'unit_price',   label:'Unit Price (₹)', placeholder:'0.00',    third:true, inputType:'number' },
    { key:'weight',       label:'Weight (kg)',     placeholder:'0.0',     third:true, inputType:'number' },
    { key:'quantity',     label:'Current Qty',    placeholder:'0',        half:true,  inputType:'number' },
    { key:'reorder_threshold', label:'Reorder Threshold', placeholder:'10', half:true, inputType:'number' },
    { key:'preferred_supplier', label:'Preferred Supplier', placeholder:'Supplier name' },
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity:0 }}
        animate={{ opacity:1 }}
        exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale:0.94, y:20, opacity:0 }}
          animate={{ scale:1, y:0, opacity:1 }}
          exit={{ scale:0.94, y:12, opacity:0 }}
          transition={{ duration:0.22, ease:[0.16,1,0.3,1] }}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
          style={{ background:'#12131f', border:'1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 z-10"
            style={{ background:'#12131f' }}>
            <div>
              <h2 className="font-display font-bold text-white text-lg">{isEdit ? 'Edit Product' : 'Add Product'}</h2>
              <p className="text-muted text-xs mt-0.5">{isEdit ? 'Update product details' : 'Create a new SKU in catalog'}</p>
            </div>
            <motion.button whileHover={{ scale:1.1, rotate:90 }} onClick={onClose} className="text-muted hover:text-white transition-colors">
              <X size={18} />
            </motion.button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted mb-1.5 block">Product Code *</label>
                <input className="input-dark w-full rounded-xl px-3 py-2.5 text-sm font-mono"
                  value={form.product_code} onChange={e => handle('product_code', e.target.value)} placeholder="CTN-001" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1.5 block">Category</label>
                <select className="input-dark w-full rounded-xl px-3 py-2.5 text-sm"
                  value={form.category} onChange={e => handle('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-1.5 block">Product Name *</label>
              <input className="input-dark w-full rounded-xl px-3 py-2.5 text-sm"
                value={form.name} onChange={e => handle('name', e.target.value)} placeholder="Premium Cotton Thread" />
            </div>

            <div>
              <label className="text-xs text-muted mb-1.5 block">Description</label>
              <textarea className="input-dark w-full rounded-xl px-3 py-2.5 text-sm resize-none" rows={2}
                value={form.description} onChange={e => handle('description', e.target.value)} placeholder="Product description..." />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted mb-1.5 block">Unit</label>
                <select className="input-dark w-full rounded-xl px-3 py-2.5 text-sm"
                  value={form.unit} onChange={e => handle('unit', e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted mb-1.5 block">Unit Price (₹)</label>
                <input type="number" className="input-dark w-full rounded-xl px-3 py-2.5 text-sm"
                  value={form.unit_price} onChange={e => handle('unit_price', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1.5 block">Weight (kg)</label>
                <input type="number" className="input-dark w-full rounded-xl px-3 py-2.5 text-sm"
                  value={form.weight} onChange={e => handle('weight', e.target.value)} placeholder="0.0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1.5 block">Current Qty</label>
                <input type="number" className="input-dark w-full rounded-xl px-3 py-2.5 text-sm"
                  value={form.quantity} onChange={e => handle('quantity', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted mb-1.5 block">Reorder Threshold</label>
                <input type="number" className="input-dark w-full rounded-xl px-3 py-2.5 text-sm"
                  value={form.reorder_threshold} onChange={e => handle('reorder_threshold', e.target.value)} placeholder="10" />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-1.5 block">Preferred Supplier</label>
              <input className="input-dark w-full rounded-xl px-3 py-2.5 text-sm"
                value={form.preferred_supplier} onChange={e => handle('preferred_supplier', e.target.value)} placeholder="Supplier name" />
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-border">
            <motion.button whileTap={{ scale:0.97 }} onClick={onClose}
              className="flex-1 py-2.5 rounded-xl btn-ghost text-sm">
              Cancel
            </motion.button>
            <motion.button whileTap={{ scale:0.97 }} onClick={handleSave} disabled={saving}
              className="btn-primary flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm">
              {saving
                ? <><motion.div animate={{ rotate:360 }} transition={{ duration:0.7, repeat:Infinity }}><Loader size={14} /></motion.div> Saving...</>
                : <><Save size={14} /> {isEdit ? 'Update' : 'Add Product'}</>
              }
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function ProductsPage() {
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [category, setCategory]   = useState('All')
  const [sortField, setSortField] = useState('name')
  const [sortAsc, setSortAsc]     = useState(true)
  const [modalProduct, setModalProduct] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting]   = useState(null)
  const [viewProduct, setViewProduct] = useState(null)

  useEffect(() => {
    fetchProducts()
    const sub = supabase.channel('products-rt')
      .on('postgres_changes', { event:'*', schema:'public', table:'products' }, fetchProducts)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [sortField, sortAsc])

  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*, supplier:supplier_id(name, credibility_score)')
      .order(sortField, { ascending: sortAsc })
    if (!error && data) setProducts(data)
    setLoading(false)
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Product deleted'); fetchProducts() }
    setDeleting(null)
  }

  function toggleSort(field) {
    if (sortField === field) setSortAsc(a => !a)
    else { setSortField(field); setSortAsc(true) }
  }

  const filtered = products.filter(p => {
    const ok = p.name.toLowerCase().includes(search.toLowerCase()) ||
               p.product_code.toLowerCase().includes(search.toLowerCase())
    return ok && (category === 'All' || p.category === category)
  })

  const SortIcon = ({ field }) => sortField === field
    ? (sortAsc ? <ChevronUp size={11} style={{ color:'#7effd4' }} /> : <ChevronDown size={11} style={{ color:'#7effd4' }} />)
    : <ChevronUp size={11} className="opacity-20" />

  const cols = [
    { label:'Code',      field:'product_code' },
    { label:'Product',   field:'name' },
    { label:'Category',  field:'category' },
    { label:'Qty',       field:'quantity' },
    { label:'Reserved',  field:'quantity_reserved' },
    { label:'Price',     field:'unit_price' },
    { label:'Threshold', field:'reorder_threshold' },
    { label:'Status',    field:null },
    { label:'Supplier',  field:'preferred_supplier' },
    { label:'',          field:null },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
        className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
      >
        <div>
          <h2 className="font-display font-bold text-white text-xl">Product Catalog</h2>
          <p className="text-muted text-sm">{products.length} SKUs · {products.filter(p=>(p.quantity||0)<p.reorder_threshold).length} critical</p>
        </div>
        <div className="flex gap-2">
          <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl btn-ghost text-sm">
            <Upload size={14} /> Import CSV
          </motion.button>
          <motion.button
            whileHover={{ scale:1.02, boxShadow:'0 0 32px rgba(126,255,212,0.35)' }}
            whileTap={{ scale:0.97 }}
            onClick={() => { setModalProduct(null); setShowModal(true) }}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
          >
            <Plus size={14} /> Add Product
          </motion.button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08 }}
        className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            className="input-dark w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
            placeholder="Search name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['All', ...CATEGORIES].map((cat, i) => (
            <motion.button
              key={cat}
              initial={{ opacity:0, scale:0.9 }}
              animate={{ opacity:1, scale:1 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ scale:1.04 }}
              whileTap={{ scale:0.97 }}
              onClick={() => setCategory(cat)}
              className="px-3 py-1.5 rounded-xl text-xs transition-all font-medium"
              style={category === cat
                ? { background:'rgba(126,255,212,0.12)', color:'#7effd4', border:'1px solid rgba(126,255,212,0.3)' }
                : { border:'1px solid var(--border)', color:'var(--muted)' }}
            >
              {cat}
            </motion.button>
          ))}
        </div>
        {(search || category !== 'All') && (
          <span className="text-xs text-muted self-center font-mono">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        )}
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.14 }}
        className="glass-card rounded-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {cols.map((col, i) => (
                  <th key={i}
                    onClick={col.field ? () => toggleSort(col.field) : undefined}
                    className={`text-left text-xs text-muted font-medium px-4 py-3.5 whitespace-nowrap select-none ${col.field ? 'cursor-pointer hover:text-white transition-colors' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.field && <SortIcon field={col.field} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_,i) => (
                  <tr key={i} className="border-b border-border/40">
                    {cols.map((_,j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 skeleton rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={cols.length}>
                    <div className="text-center py-16 text-muted">
                      <Package size={36} className="mx-auto mb-3 opacity-20" />
                      <p className="text-sm">No products found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filtered.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity:0, y:6 }}
                      animate={{ opacity:1, y:0 }}
                      exit={{ opacity:0 }}
                      transition={{ delay: Math.min(i * 0.025, 0.2) }}
                      className="border-b border-border/40 hover:bg-white/[0.025] transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs" style={{ color:'rgba(126,255,212,0.7)' }}>{p.product_code}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-white">{p.name}</div>
                        {p.description && <div className="text-xs text-muted truncate max-w-40">{p.description}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs px-2 py-1 rounded-lg font-mono"
                          style={{ background:'rgba(96,165,250,0.1)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.2)' }}>
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-white">
                        {p.quantity} <span className="text-muted text-xs font-normal">{p.unit}</span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-yellow-400/80">{p.quantity_reserved || 0}</td>
                      <td className="px-4 py-3.5 font-mono text-white/80">₹{parseFloat(p.unit_price||0).toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-muted font-mono">{p.reorder_threshold}</td>
                      <td className="px-4 py-3.5"><StatusBadge qty={p.quantity} threshold={p.reorder_threshold} /></td>
                      <td className="px-4 py-3.5 text-muted text-xs max-w-24">
                        <div className="truncate">{p.preferred_supplier || p.suppliers?.name || '—'}</div>
                        {p.suppliers?.credibility_score > 0 && (
                          <div className="font-mono" style={{ color:'#7effd4' }}>{p.suppliers.credibility_score}%</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <motion.button
                            whileHover={{ scale:1.1 }} whileTap={{ scale:0.9 }}
                            onClick={() => setViewProduct(p)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.2)' }}
                          >
                            <Eye size={11} style={{ color:'#60a5fa' }} />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale:1.1 }} whileTap={{ scale:0.9 }}
                            onClick={() => { setModalProduct(p); setShowModal(true) }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ background:'rgba(126,255,212,0.1)', border:'1px solid rgba(126,255,212,0.2)' }}
                          >
                            <Edit3 size={11} style={{ color:'#7effd4' }} />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale:1.1 }} whileTap={{ scale:0.9 }}
                            onClick={() => handleDelete(p.id, p.name)}
                            disabled={deleting === p.id}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)' }}
                          >
                            {deleting === p.id
                              ? <motion.div animate={{ rotate:360 }} transition={{ duration:0.7, repeat:Infinity }}><Loader size={11} style={{ color:'#f87171' }} /></motion.div>
                              : <Trash2 size={11} style={{ color:'#f87171' }} />}
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted">
          <span>{filtered.length} of {products.length} products</span>
          <span className="font-mono">
            Value: ₹{products.reduce((s,p)=>(s+(p.quantity||0)*(p.unit_price||0)),0).toLocaleString()}
          </span>
        </div>
      </motion.div>

      {/* Quick view modal */}
      <AnimatePresence>
        {viewProduct && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setViewProduct(null)}
          >
            <motion.div
              initial={{ scale:0.94, y:20 }}
              animate={{ scale:1, y:0 }}
              exit={{ scale:0.94, y:12 }}
              className="w-full max-w-sm rounded-2xl p-6"
              style={{ background:'#12131f', border:'1px solid rgba(126,255,212,0.15)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="font-mono text-xs" style={{ color:'#7effd4' }}>{viewProduct.product_code}</span>
                  <h3 className="font-display font-bold text-white text-lg mt-0.5">{viewProduct.name}</h3>
                </div>
                <button onClick={() => setViewProduct(null)} className="text-muted hover:text-white"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l:'Category',  v:viewProduct.category },
                  { l:'Unit',      v:viewProduct.unit },
                  { l:'On Hand',   v:`${viewProduct.quantity} ${viewProduct.unit}` },
                  { l:'Reserved',  v:`${viewProduct.quantity_reserved || 0} ${viewProduct.unit}` },
                  { l:'Available', v:`${(viewProduct.quantity||0)-(viewProduct.quantity_reserved||0)} ${viewProduct.unit}` },
                  { l:'Threshold', v:`${viewProduct.reorder_threshold} ${viewProduct.unit}` },
                  { l:'Unit Price',v:`₹${parseFloat(viewProduct.unit_price||0).toLocaleString()}` },
                  { l:'Supplier',  v:viewProduct.preferred_supplier || '—' },
                ].map(({ l, v }) => (
                  <div key={l} className="p-3 rounded-xl" style={{ background:'rgba(255,255,255,0.03)' }}>
                    <div className="text-xs text-muted mb-0.5">{l}</div>
                    <div className="text-sm text-white font-medium">{v}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <ProductModal
            product={modalProduct}
            onClose={() => setShowModal(false)}
            onSave={fetchProducts}
          />
        )}
      </AnimatePresence>
    </div>
  )
}