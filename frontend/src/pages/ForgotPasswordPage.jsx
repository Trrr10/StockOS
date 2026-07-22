import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Layers, ArrowLeft, Send, Loader, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { resetPassword } = useAuth()

  async function handleReset(e) {
    e.preventDefault()
    if (!email) return toast.error('Enter your email address')
    setLoading(true)
    const { error } = await resetPassword(email)
    if (error) toast.error(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-obsidian grid-bg flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-accent/4 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
            <Layers size={18} className="text-accent" />
          </div>
          <span className="font-display font-bold text-white text-xl">StockSense</span>
        </div>

        <div className="glass-card rounded-2xl p-8">
          {!sent ? (
            <>
              <div className="mb-8">
                <h1 className="font-display font-bold text-2xl text-white mb-1">Reset password</h1>
                <p className="text-muted text-sm">We'll send a reset link to your email</p>
              </div>

              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <CheckCircle size={48} className="text-accent mx-auto mb-4" />
              <h2 className="font-display font-bold text-xl text-white mb-2">Check your inbox</h2>
              <p className="text-muted text-sm mb-6">
                Reset link sent to <span className="text-white">{email}</span>
              </p>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/login" className="text-xs text-muted hover:text-white transition-colors flex items-center gap-1 justify-center">
            <ArrowLeft size={12} /> Back to sign in
          </Link>
        </div>
      </motion.div>
    </div>
  )
}