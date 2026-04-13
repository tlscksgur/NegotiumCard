import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import './App.css'

type AuthMode = 'login' | 'signup'

type AuthResponse = {
  userId: number
  name: string
  email: string
  accessToken: string
  refreshToken: string
}

type OcrResult = {
  id: number
  rawText: string | null
  name: string | null
  company: string | null
  department: string | null
  position: string | null
  email: string | null
  phone: string | null
}

type Person = {
  id: number
  name: string | null
  normalizedName: string | null
  email: string | null
  phone: string | null
  companyId: number | null
  companyName: string | null
  departmentId: number | null
  departmentName: string | null
  positionId: number | null
  positionName: string | null
}

type CardResponse = {
  id: number
  imageUrl: string
  originalFileName: string | null
  status: string
  createdAt: string
  updatedAt: string
  person: Person | null
  ocrResult: OcrResult | null
}

type ApiError = {
  detail?: string
  message?: string
  error?: string
}

type OcrUpdateRequest = {
  rawText?: string | null
  name?: string | null
  company?: string | null
  department?: string | null
  position?: string | null
  email?: string | null
  phone?: string | null
}

const AUTH_STORAGE_KEY = 'negotium-auth'

function getInitialBadge(name?: string | null) {
  const base = (name ?? '').trim()
  if (!base) {
    return 'NC'
  }

  const compact = base.replace(/\s+/g, '')
  return compact.slice(0, Math.min(2, compact.length)).toUpperCase()
}

function getErrorMessage(data: unknown) {
  if (typeof data === 'string') {
    return data
  }

  if (typeof data === 'object' && data !== null) {
    const apiError = data as ApiError
    return apiError.detail ?? apiError.message ?? apiError.error ?? 'Request failed.'
  }

  return 'Request failed.'
}

async function fetchCards(accessToken: string) {
  const response = await fetch('/api/v1/cards', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const errorBody = await parseMaybeJson(response)
    throw new Error(getErrorMessage(errorBody))
  }

  return (await response.json()) as CardResponse[]
}

function App() {
  return (
    <BrowserRouter>
      <MobileCardApp />
    </BrowserRouter>
  )
}

function MobileCardApp() {
  const navigate = useNavigate()
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [auth, setAuth] = useState<AuthResponse | null>(null)
  const [name, setName] = useState('Test User')
  const [email, setEmail] = useState('tester@example.com')
  const [password, setPassword] = useState('password123')
  const [serverStatus, setServerStatus] = useState('checking server...')
  const [cards, setCards] = useState<CardResponse[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzingCardId, setAnalyzingCardId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('Sign in and upload a business card to start.')

  useEffect(() => {
    const savedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!savedAuth) {
      return
    }

    try {
      setAuth(JSON.parse(savedAuth) as AuthResponse)
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch('/api/test')
        const text = await response.text()
        setServerStatus(text || 'server ok')
      } catch {
        setServerStatus('server offline')
      }
    }

    void checkServer()
  }, [])

  useEffect(() => {
    if (!auth) {
      setCards([])
      return
    }

    void refreshCards()
  }, [auth])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setFeedback('')

    try {
      const response = await fetch(`/api/v1/auth/${authMode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authMode === 'signup' ? { name, email, password } : { email, password }),
      })

      const payload = await parseMaybeJson(response)
      if (!response.ok) {
        throw new Error(getErrorMessage(payload))
      }

      const nextAuth = payload as AuthResponse
      setAuth(nextAuth)
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth))
      setFeedback(`Welcome, ${nextAuth.name}.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  const handleUpload = async () => {
    if (!auth || !selectedFile) {
      return
    }

    setLoading(true)
    setFeedback('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/v1/cards/image', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: formData,
      })

      const payload = await parseMaybeJson(response)
      if (!response.ok) {
        throw new Error(getErrorMessage(payload))
      }

      setCards(await fetchCards(auth.accessToken))
      setFeedback('Card uploaded successfully. Run analysis from the archive or latest feed.')
      setSelectedFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeCard = async (cardId: number) => {
    if (!auth) {
      return
    }

    setAnalyzingCardId(cardId)
    setFeedback('')

    try {
      const response = await fetch(`/api/v1/cards/${cardId}/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      })

      const payload = await parseMaybeJson(response)
      if (!response.ok) {
        throw new Error(getErrorMessage(payload))
      }

      setCards(await fetchCards(auth.accessToken))
      setFeedback('Analysis completed.')
      navigate(`/digital/${cardId}`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Analysis failed.')
    } finally {
      setAnalyzingCardId(null)
    }
  }

  const handleLogout = () => {
    setAuth(null)
    setCards([])
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setFeedback('Logged out.')
    navigate('/')
  }

  const refreshCards = async () => {
    if (!auth) {
      return
    }

    try {
      setCards(await fetchCards(auth.accessToken))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to load cards.')
    }
  }

  if (!auth) {
    return (
      <main className="app-shell">
        <section className="phone-frame auth-frame">
          <div className="phone-header">
            <div>
              <p className="eyebrow">NEGOTIUM CARD APP</p>
              <h1>Digital business cards</h1>
            </div>
            <span className={`server-badge ${serverStatus === 'server ok' ? 'online' : 'offline'}`}>{serverStatus}</span>
          </div>

          <section className="panel hero-panel">
            <p className="hero-kicker">MOBILE WEB MVP</p>
            <h2>Upload, analyze, and organize business cards in one place.</h2>
            <p>The app connects Spring, FastAPI, and the card archive so you can inspect analysis results immediately.</p>
          </section>

          <section className="panel auth-panel">
            <div className="auth-switch">
              <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')} type="button">
                Login
              </button>
              <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')} type="button">
                Sign up
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <label>
                  Name
                  <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
              )}
              <label>
                Email
                <input value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? 'Processing...' : authMode === 'login' ? 'Login' : 'Sign up'}
              </button>
            </form>
          </section>

          <p className="feedback">{feedback}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <header className="top-bar">
          <div>
            <p className="eyebrow">NEGOTIUM CARD APP</p>
            <h1>{auth.name}'s cards</h1>
          </div>
          <button className="secondary-button" onClick={handleLogout} type="button">
            Logout
          </button>
        </header>

        <nav className="tab-nav">
          <NavLink end to="/">
            Upload
          </NavLink>
          <NavLink to="/cards">Archive</NavLink>
          <NavLink to="/digital">Digital card</NavLink>
        </nav>

        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                cards={cards}
                previewUrl={previewUrl}
                selectedFile={selectedFile}
                loading={loading}
                analyzingCardId={analyzingCardId}
                onAnalyze={handleAnalyzeCard}
                onFileChange={handleFileChange}
                onUpload={handleUpload}
              />
            }
          />
          <Route path="/cards" element={<ArchivePage cards={cards} onAnalyze={handleAnalyzeCard} analyzingCardId={analyzingCardId} />} />
          <Route path="/digital" element={<DigitalCardPage cards={cards} accessToken={auth.accessToken} onRefreshCards={refreshCards} />} />
          <Route path="/digital/:cardId" element={<DigitalCardPage cards={cards} accessToken={auth.accessToken} onRefreshCards={refreshCards} />} />
        </Routes>

        <p className="feedback">{feedback}</p>
      </section>
    </main>
  )
}

function HomePage({
  cards,
  previewUrl,
  selectedFile,
  loading,
  analyzingCardId,
  onAnalyze,
  onFileChange,
  onUpload,
}: {
  cards: CardResponse[]
  previewUrl: string | null
  selectedFile: File | null
  loading: boolean
  analyzingCardId: number | null
  onAnalyze: (cardId: number) => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUpload: () => void
}) {
  return (
    <div className="page-stack">
      <section className="panel profile-panel">
        <div>
          <p className="profile-name">Cards stored: {cards.length}</p>
          <p className="profile-email">Upload a card, then run OCR and YOLO analysis from the feed.</p>
        </div>
      </section>

      <section className="panel upload-panel">
        <div className="panel-title">
          <h2>Card upload</h2>
          <p>Use the dropzone to add a business card image.</p>
        </div>

        <label className="upload-dropzone">
          <input accept="image/*" onChange={onFileChange} type="file" />
          {previewUrl ? (
            <img alt="Business card preview" src={previewUrl} />
          ) : (
            <div className="upload-placeholder">
              <strong>Tap to upload</strong>
              <span>PNG, JPG, WEBP</span>
            </div>
          )}
        </label>

        <button className="primary-button" disabled={!selectedFile || loading} onClick={onUpload} type="button">
          {loading ? 'Uploading...' : 'Upload card'}
        </button>
      </section>

      <section className="panel feed-panel">
        <div className="panel-title">
          <h2>Latest cards</h2>
          <p>Run analysis from the latest uploaded cards.</p>
        </div>

        <div className="card-feed">
          {cards.length === 0 ? (
            <p className="empty-state">No cards uploaded yet.</p>
          ) : (
            cards.slice(0, 3).map((card) => (
              <article className="feed-item" key={card.id}>
                <img alt={card.originalFileName ?? 'Business card'} src={card.imageUrl} />
                <div className="feed-copy">
                  <strong>{card.ocrResult?.name ?? card.originalFileName ?? `card-${card.id}`}</strong>
                  <span>{card.ocrResult?.company ?? 'No company detected yet'}</span>
                  <span>{card.status}</span>
                </div>
                <div className="feed-actions">
                  <button className="secondary-button" disabled={analyzingCardId === card.id} onClick={() => onAnalyze(card.id)} type="button">
                    {analyzingCardId === card.id ? 'Analyzing...' : 'Analyze'}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function ArchivePage({
  cards,
  onAnalyze,
  analyzingCardId,
}: {
  cards: CardResponse[]
  onAnalyze: (cardId: number) => void
  analyzingCardId: number | null
}) {
  return (
    <div className="page-stack">
      <section className="panel archive-intro">
        <div className="panel-title">
          <h2>Archive</h2>
          <p>Re-run analysis or open the digital card from here.</p>
        </div>
      </section>

      <section className="archive-grid">
        {cards.length === 0 ? (
          <p className="empty-state panel">The archive is empty.</p>
        ) : (
          cards.map((card) => (
            <article className="archive-card" key={card.id}>
              <img alt={card.originalFileName ?? 'Business card'} src={card.imageUrl} />
              <div className="archive-copy">
                <strong>{card.ocrResult?.name ?? card.originalFileName ?? `card-${card.id}`}</strong>
                <span>{card.ocrResult?.company ?? 'No company detected yet'}</span>
                <span>{card.ocrResult?.position ?? 'No position detected yet'}</span>
              </div>
              <div className="archive-actions">
                <button className="secondary-button" disabled={analyzingCardId === card.id} onClick={() => onAnalyze(card.id)} type="button">
                  {analyzingCardId === card.id ? 'Analyzing...' : 'Analyze'}
                </button>
                <Link className="inline-link" to={`/digital/${card.id}`}>
                  Open digital card
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}

function DigitalCardPage({
  cards,
  accessToken,
  onRefreshCards,
}: {
  cards: CardResponse[]
  accessToken: string
  onRefreshCards: () => Promise<void>
}) {
  const { cardId } = useParams()
  const selectedCard = cards.find((card) => String(card.id) === cardId) ?? cards[0]
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [rawText, setRawText] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [department, setDepartment] = useState('')
  const [position, setPosition] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    const ocr = selectedCard?.ocrResult
    setRawText(ocr?.rawText ?? '')
    setName(ocr?.name ?? '')
    setCompany(ocr?.company ?? '')
    setDepartment(ocr?.department ?? '')
    setPosition(ocr?.position ?? '')
    setEmail(ocr?.email ?? '')
    setPhone(ocr?.phone ?? '')
    setStatus('')
  }, [selectedCard?.id])

  const handleSaveOcr = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCard) {
      return
    }

    setSaving(true)
    setStatus('')

    try {
      const response = await fetch(`/api/v1/cards/${selectedCard.id}/ocr`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawText: toNullable(rawText),
          name: toNullable(name),
          company: toNullable(company),
          department: toNullable(department),
          position: toNullable(position),
          email: toNullable(email),
          phone: toNullable(phone),
        } satisfies OcrUpdateRequest),
      })

      const payload = await parseMaybeJson(response)
      if (!response.ok) {
        throw new Error(getErrorMessage(payload))
      }

      await onRefreshCards()
      setStatus('OCR data saved.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save OCR data.')
    } finally {
      setSaving(false)
    }
  }

  if (!selectedCard) {
    return (
      <section className="panel">
        <p className="empty-state">Upload a card first, then open the digital card view.</p>
      </section>
    )
  }

  const ocr = selectedCard.ocrResult

  return (
    <div className="page-stack">
      <section className="panel digital-selector-panel">
        <div className="panel-title">
          <h2>Digital cards</h2>
          <p>Select a card to inspect analysis results.</p>
        </div>

        <div className="digital-selector-list">
          {cards.map((card) => (
            <Link
              className={`digital-selector-item ${card.id === selectedCard.id ? 'active' : ''}`}
              key={card.id}
              to={`/digital/${card.id}`}
            >
              <div className="digital-selector-copy">
                <div className="digital-selector-headline">
                  <strong>{card.ocrResult?.name ?? card.originalFileName ?? `card-${card.id}`}</strong>
                  <em>{card.ocrResult?.position ?? card.status}</em>
                </div>
                <span>{card.ocrResult?.company ?? 'No company detected yet'}</span>
              </div>
              <div className="digital-selector-badge" aria-hidden="true">
                {getInitialBadge(card.ocrResult?.name)}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="digital-card">
        <div className="digital-card-top">
          <span className="chip">{ocr?.company ?? 'Unknown company'}</span>
          <span className="chip muted">{selectedCard.status}</span>
        </div>

        <div className="digital-card-main">
          <div>
            <p className="digital-label">NAME</p>
            <h2>{ocr?.name ?? 'Unknown name'}</h2>
          </div>
          <div className="digital-meta">
            <p>{ocr?.position ?? 'Unknown position'}</p>
            <p>{ocr?.department ?? 'Unknown department'}</p>
          </div>
        </div>

        <div className="digital-card-bottom">
          <div>
            <span>EMAIL</span>
            <strong>{ocr?.email ?? '-'}</strong>
          </div>
          <div>
            <span>PHONE</span>
            <strong>{ocr?.phone ?? '-'}</strong>
          </div>
        </div>

        <div className="digital-card-details">
          <div>
            <span>COMPANY</span>
            <strong>{ocr?.company ?? '-'}</strong>
          </div>
          <div>
            <span>DEPARTMENT</span>
            <strong>{ocr?.department ?? '-'}</strong>
          </div>
          <div>
            <span>POSITION</span>
            <strong>{ocr?.position ?? '-'}</strong>
          </div>
          <div>
            <span>FILE</span>
            <strong>{selectedCard.originalFileName ?? `card-${selectedCard.id}`}</strong>
          </div>
        </div>
      </section>

      <section className="panel image-panel">
        <div className="panel-title">
          <h2>Original image</h2>
          <p>Compare the OCR result with the original card image.</p>
        </div>
        <img alt={selectedCard.originalFileName ?? 'Business card'} className="full-card-image" src={selectedCard.imageUrl} />
      </section>

      <section className="panel raw-text-panel">
        <div className="panel-title">
          <h2>Raw text</h2>
          <p>The OCR output is shown here for editing or verification.</p>
        </div>
        <form className="ocr-editor" onSubmit={handleSaveOcr}>
          <label>
            Raw text
            <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={6} />
          </label>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Company
            <input value={company} onChange={(event) => setCompany(event.target.value)} />
          </label>
          <label>
            Department
            <input value={department} onChange={(event) => setDepartment(event.target.value)} />
          </label>
          <label>
            Position
            <input value={position} onChange={(event) => setPosition(event.target.value)} />
          </label>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Phone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Saving...' : 'Save OCR data'}
          </button>
        </form>
        <p className="feedback">{status || ocr?.rawText || 'No OCR result yet.'}</p>
      </section>
    </div>
  )
}

async function parseMaybeJson(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

function toNullable(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export default App
