import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import './App.css'

// --- Types ---

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

type CompanyResponse = {
  id: number
  name: string
  normalizedName: string | null
}

type DepartmentNode = {
  id: number
  name: string
  depth: number
  persons: Person[]
  children: DepartmentNode[]
}

type OrganizationTreeResponse = {
  companyId: number
  companyName: string
  departments: DepartmentNode[]
}

type PagedResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

type ManualCardRequest = {
  originalFileName: string | null
  rawText: string | null
  name: string
  company: string
  department: string | null
  position: string | null
  email: string | null
  phone: string | null
}

const AUTH_STORAGE_KEY = 'negotium-auth'

class ApiRequestError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

function isAuthError(error: unknown) {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403)
}

// --- Icons (Inline SVGs) ---

const Icons = {
  Home: () => (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Cards: () => (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Search: () => (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Org: () => (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Plus: () => (
    <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Logout: () => (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

// --- App Component ---

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
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [cards, setCards] = useState<CardResponse[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzingCardId, setAnalyzingCardId] = useState<number | null>(null)
  const [deletingCardId, setDeletingCardId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const savedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (savedAuth) {
      try {
        setAuth(JSON.parse(savedAuth) as AuthResponse)
      } catch {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    }
  }, [])

  useEffect(() => {
    if (auth) {
      void fetchCards(auth.accessToken)
        .then((response) => setCards(response))
        .catch((error: unknown) => {
          setFeedbackFromError(error, '명함 목록을 불러오지 못했습니다.')
        })
    } else {
      setCards([])
    }
  }, [auth])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const clearAuthState = (message = '세션이 만료되었습니다. 다시 로그인하세요.') => {
    setAuth(null)
    setCards([])
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setFeedback(message)
    navigate('/')
  }

  const setFeedbackFromError = (error: unknown, fallbackMessage: string) => {
    if (isAuthError(error)) {
      clearAuthState()
      return
    }

    setFeedback(error instanceof Error ? error.message : fallbackMessage)
  }

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setFeedback('')

    try {
      const path = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/signup'
      const response = await apiRequest<AuthResponse>(path, {
        method: 'POST',
        body: authMode === 'login' ? { email, password } : { name, email, password },
      })

      setAuth(response)
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response))
      setFeedback('')
    } catch (error) {
      setFeedbackFromError(error, '인증에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearAuthState('로그아웃되었습니다.')
  }

  const refreshCards = async () => {
    if (!auth) return
    const response = await fetchCards(auth.accessToken)
    setCards(response)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      navigate('/upload')
    }
  }

  const handleUpload = async () => {
    if (!auth || !selectedFile) return
    setLoading(true)
    setFeedback('')

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      await apiRequest<CardResponse>('/api/v1/cards/image', {
        method: 'POST',
        accessToken: auth.accessToken,
        body: formData,
      })
      await refreshCards()
      setSelectedFile(null)
      setPreviewUrl(null)
      navigate('/cards')
    } catch (error) {
      setFeedbackFromError(error, '업로드에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeCard = async (cardId: number) => {
    if (!auth) return
    setAnalyzingCardId(cardId)
    setFeedback('')

    try {
      await apiRequest<CardResponse>(`/api/v1/cards/${cardId}/analyze`, {
        method: 'POST',
        accessToken: auth.accessToken,
      })
      await refreshCards()
    } catch (error) {
      setFeedbackFromError(error, '분석에 실패했습니다.')
    } finally {
      setAnalyzingCardId(null)
    }
  }

  const handleDeleteCard = async (cardId: number) => {
    if (!auth) return false
    setDeletingCardId(cardId)

    try {
      await apiRequest(`/api/v1/cards/${cardId}`, {
        method: 'DELETE',
        accessToken: auth.accessToken,
      })
      await refreshCards()
      return true
    } catch (error) {
      setFeedbackFromError(error, '삭제에 실패했습니다.')
      return false
    } finally {
      setDeletingCardId(null)
    }
  }

  const handleCreateManualCard = async (request: ManualCardRequest) => {
    if (!auth) return null
    setLoading(true)

    try {
      const response = await apiRequest<CardResponse>('/api/v1/cards/manual', {
        method: 'POST',
        accessToken: auth.accessToken,
        body: request,
      })
      await refreshCards()
      return response
    } catch (error) {
      setFeedbackFromError(error, '수기 등록에 실패했습니다.')
      return null
    } finally {
      setLoading(false)
    }
  }

  if (!auth) {
    return (
      <main className="app-shell">
        <div className="app-container" style={{ paddingTop: '80px' }}>
          <section className="panel">
            <h1 style={{ textAlign: 'center', marginBottom: '8px' }}>Negotium Card</h1>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '32px' }}>
              비즈니스 네트워크의 시작, 명함 아카이브
            </p>

            <div className="flex-between" style={{ background: '#f3f4f6', padding: '4px', borderRadius: '12px', marginBottom: '24px' }}>
              <button
                className={authMode === 'login' ? 'secondary-btn active' : 'secondary-btn'}
                style={{ flex: 1, border: 'none', background: authMode === 'login' ? 'white' : 'transparent', boxShadow: authMode === 'login' ? 'var(--shadow-sm)' : 'none' }}
                onClick={() => setAuthMode('login')}
              >
                로그인
              </button>
              <button
                className={authMode === 'signup' ? 'secondary-btn active' : 'secondary-btn'}
                style={{ flex: 1, border: 'none', background: authMode === 'signup' ? 'white' : 'transparent', boxShadow: authMode === 'signup' ? 'var(--shadow-sm)' : 'none' }}
                onClick={() => setAuthMode('signup')}
              >
                회원가입
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <div className="form-group">
                  <label className="form-label">이름</label>
                  <input className="form-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="실명을 입력하세요" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">이메일</label>
                <input className="form-input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" />
              </div>
              <div className="form-group">
                <label className="form-label">비밀번호</label>
                <input className="form-input" required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button className="primary-btn" disabled={loading} type="submit">
                {loading ? '처리 중...' : authMode === 'login' ? '로그인' : '회원가입'}
              </button>
            </form>
          </section>
          {feedback && <p className="empty-state" style={{ color: 'var(--danger)' }}>{feedback}</p>}
        </div>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <header className="top-header">
        <h1>Negotium</h1>
        <button className="secondary-btn" style={{ width: 'auto', padding: '8px 12px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={handleLogout}>
          <Icons.Logout />
          <span>로그아웃</span>
        </button>
      </header>

      <main className="app-container" style={{ paddingBottom: '40px' }}>
        <Routes>
          <Route path="/" element={<DashboardPage cards={cards} />} />
          <Route
            path="/upload"
            element={
              <UploadPage
                previewUrl={previewUrl}
                loading={loading}
                onFileChange={handleFileChange}
                onUpload={handleUpload}
                onCreateManual={handleCreateManualCard}
              />
            }
          />
          <Route
            path="/cards"
            element={
              <CardListPage
                cards={cards}
                analyzingCardId={analyzingCardId}
                onAnalyze={handleAnalyzeCard}
              />
            }
          />
          <Route path="/search" element={<SearchPage accessToken={auth.accessToken} cards={cards} />} />
          <Route path="/org" element={<OrganizationPage accessToken={auth.accessToken} />} />
          <Route
            path="/digital/:cardId"
            element={
              <DigitalCardDetail
                accessToken={auth.accessToken}
                cards={cards}
                deletingCardId={deletingCardId}
                onDeleteCard={handleDeleteCard}
                onRefreshCards={refreshCards}
              />
            }
          />
        </Routes>
      </main>

      {location.pathname !== '/upload' && (
        <label className="fab">
          <Icons.Plus />
          <input accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} type="file" />
        </label>
      )}

      <nav className="bottom-nav">
        <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} to="/">
          <Icons.Home />
          <span>홈</span>
        </NavLink>
        <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} to="/cards">
          <Icons.Cards />
          <span>명함첩</span>
        </NavLink>
        <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} to="/search">
          <Icons.Search />
          <span>검색</span>
        </NavLink>
        <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} to="/org">
          <Icons.Org />
          <span>조직도</span>
        </NavLink>
      </nav>
    </div>
  )
}

// --- Sub-pages ---

function DashboardPage({ cards }: { cards: CardResponse[] }) {
  const imageCardCount = cards.filter(isAnalyzableCard).length
  const manualCardCount = cards.length - imageCardCount
  const recentCards = cards.slice(0, 3)

  return (
    <div style={{ paddingTop: '20px' }}>
      <section className="card-section">
        <h2 className="section-title">내 명함 현황</h2>
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-value">{cards.length}</span>
            <span className="stat-label">전체</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{imageCardCount}</span>
            <span className="stat-label">이미지</span>
          </div>
          <div className="stat-box">
            <span className="stat-value">{manualCardCount}</span>
            <span className="stat-label">수기</span>
          </div>
        </div>
      </section>

      <section className="card-section">
        <div className="section-title">
          <h2>최근 등록한 명함</h2>
          <Link to="/cards" style={{ fontSize: '0.875rem', color: 'var(--primary)', textDecoration: 'none' }}>전체보기</Link>
        </div>
        {recentCards.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            등록된 명함이 없습니다.
          </div>
        ) : (
          recentCards.map((card) => <CardItem key={card.id} card={card} />)
        )}
      </section>

      <section className="card-section">
        <h2 className="section-title">빠른 기능</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Link className="panel" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }} to="/search">
            <div style={{ background: '#f5f3ff', padding: '12px', borderRadius: '50%', color: 'var(--primary)' }}><Icons.Search /></div>
            <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>인물 검색</span>
          </Link>
          <Link className="panel" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }} to="/org">
            <div style={{ background: '#f5f3ff', padding: '12px', borderRadius: '50%', color: 'var(--primary)' }}><Icons.Org /></div>
            <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>조직도 보기</span>
          </Link>
        </div>
      </section>
    </div>
  )
}

function UploadPage({
  previewUrl,
  loading,
  onFileChange,
  onUpload,
  onCreateManual,
}: {
  previewUrl: string | null
  loading: boolean
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onUpload: () => void
  onCreateManual: (req: ManualCardRequest) => Promise<CardResponse | null>
}) {
  const navigate = useNavigate()
  const [isManual, setIsManual] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', dept: '', pos: '', email: '', phone: '' })

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const res = await onCreateManual({
      originalFileName: 'manual-entry',
      rawText: null,
      name: form.name,
      company: form.company,
      department: form.dept || null,
      position: form.pos || null,
      email: form.email || null,
      phone: form.phone || null,
    })
    if (res) navigate('/cards')
  }

  return (
    <div style={{ paddingTop: '20px' }}>
      <div className="section-title">
        <h2>명함 등록</h2>
        <button className="secondary-btn" style={{ width: 'auto', border: 'none' }} onClick={() => navigate(-1)}>닫기</button>
      </div>

      {!isManual ? (
        <div className="panel" style={{ textAlign: 'center' }}>
          {previewUrl ? (
            <img alt="Preview" src={previewUrl} style={{ width: '100%', borderRadius: '12px', marginBottom: '20px' }} />
          ) : (
            <div style={{ padding: '40px 0', border: '2px dashed var(--border)', borderRadius: '12px', marginBottom: '20px' }}>
              <p style={{ color: 'var(--text-muted)' }}>선택된 파일이 없습니다.</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <label className="secondary-btn" style={{ flex: 1, cursor: 'pointer', textAlign: 'center' }}>
              파일 다시 선택
              <input accept="image/*" onChange={onFileChange} style={{ display: 'none' }} type="file" />
            </label>
            <button className="primary-btn" disabled={!previewUrl || loading} onClick={onUpload} style={{ flex: 1 }}>
              {loading ? '업로드 중...' : '업로드 시작'}
            </button>
          </div>
          <button
            className="secondary-btn"
            style={{ marginTop: '20px', border: 'none', color: 'var(--primary)' }}
            onClick={() => setIsManual(true)}
          >
            이미지가 없으신가요? 수기 등록하기
          </button>
        </div>
      ) : (
        <form className="panel" onSubmit={handleManualSubmit}>
          <div className="form-group">
            <label className="form-label">이름</label>
            <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">회사</label>
            <input className="form-input" required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">부서</label>
            <input className="form-input" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">직책</label>
            <input className="form-input" value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })} />
          </div>
          <button className="primary-btn" disabled={loading} type="submit">
            {loading ? '저장 중...' : '수기 등록 저장'}
          </button>
          <button className="secondary-btn" style={{ marginTop: '12px', border: 'none' }} onClick={() => setIsManual(false)}>뒤로 가기</button>
        </form>
      )}
    </div>
  )
}

function CardListPage({
  cards,
  analyzingCardId,
  onAnalyze,
}: {
  cards: CardResponse[]
  analyzingCardId: number | null
  onAnalyze: (id: number) => void
}) {
  return (
    <div style={{ paddingTop: '20px' }}>
      <h2 className="section-title">내 명함첩</h2>
      {cards.length === 0 ? (
        <div className="empty-state">
          등록된 명함이 없습니다.<br />우측 하단 + 버튼을 눌러 등록하세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cards.map((card) => (
            <CardItem
              analyzing={analyzingCardId === card.id}
              card={card}
              key={card.id}
              onAnalyze={() => onAnalyze(card.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CardItem({ card, analyzing, onAnalyze }: { card: CardResponse; analyzing?: boolean; onAnalyze?: () => void }) {
  return (
    <Link className="app-card" to={`/digital/${card.id}`}>
      <img alt="Thumbnail" className="app-card-img" src={isAnalyzableCard(card) ? card.imageUrl : '/placeholder.png'} />
      <div className="app-card-content">
        <span className="app-card-title">{getCardTitle(card)}</span>
        <span className="app-card-subtitle">{card.ocrResult?.company ?? '회사 정보 없음'}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.ocrResult?.position ?? card.status}</span>
      </div>
      {analyzing ? (
        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>분석중...</span>
      ) : card.status === 'UPLOADED' && onAnalyze ? (
        <button
          className="secondary-btn"
          onClick={(e) => { e.preventDefault(); onAnalyze(); }}
          style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem' }}
        >
          분석하기
        </button>
      ) : null}
    </Link>
  )
}

function DigitalCardDetail({
  accessToken,
  cards,
  deletingCardId,
  onDeleteCard,
  onRefreshCards,
}: {
  accessToken: string
  cards: CardResponse[]
  deletingCardId: number | null
  onDeleteCard: (id: number) => Promise<boolean>
  onRefreshCards: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { cardId } = useParams()
  const card = cards.find((c) => String(c.id) === cardId)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', dept: '', pos: '', email: '', phone: '' })

  useEffect(() => {
    if (card?.ocrResult) {
      const ocr = card.ocrResult
      setForm({
        name: ocr.name ?? '',
        company: ocr.company ?? '',
        dept: ocr.department ?? '',
        pos: ocr.position ?? '',
        email: ocr.email ?? '',
        phone: ocr.phone ?? '',
      })
    }
  }, [card])

  if (!card) return <div className="empty-state">명함을 찾을 수 없습니다.</div>

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await apiRequest(`/api/v1/cards/${card.id}/ocr`, {
        method: 'PATCH',
        accessToken,
        body: {
          name: form.name || null,
          company: form.company || null,
          department: form.dept || null,
          position: form.pos || null,
          email: form.email || null,
          phone: form.phone || null,
        },
      })
      await onRefreshCards()
      setEditMode(false)
    } catch (err) {
      alert('저장 실패')
    }
  }

  const ocr = card.ocrResult

  return (
    <div style={{ paddingTop: '20px' }}>
      <div className="section-title">
        <button className="secondary-btn" style={{ width: 'auto', border: 'none' }} onClick={() => navigate(-1)}>뒤로</button>
        <h2>명함 상세</h2>
        <button className="secondary-btn" style={{ width: 'auto', border: 'none', color: 'var(--primary)' }} onClick={() => setEditMode(!editMode)}>
          {editMode ? '취소' : '편집'}
        </button>
      </div>

      <div className="digital-card-hero">
        <div className="hero-header">
          <span className="hero-company">{ocr?.company ?? '회사 정보 없음'}</span>
          <div className="hero-status-badges">
            <span className="hero-badge">{isAnalyzableCard(card) ? '이미지' : '수기'}</span>
          </div>
        </div>
        
        <div className="hero-body">
          <h2 className="hero-name">{ocr?.name ?? '이름 미확인'}</h2>
          <div className="hero-meta">
            <span className="hero-pos">{ocr?.position ?? '직책 미확인'}</span>
            {ocr?.department && <span className="hero-dept"> | {ocr.department}</span>}
          </div>
        </div>

        <div className="hero-footer">
          <div className="hero-contact-item">
            <span className="hero-label">Email</span>
            <span className="hero-value">{ocr?.email ?? '-'}</span>
          </div>
          <div className="hero-contact-item">
            <span className="hero-label">Phone</span>
            <span className="hero-value">{ocr?.phone ?? '-'}</span>
          </div>
        </div>
      </div>

      {editMode ? (
        <form className="panel" onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">이름</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">회사</label>
            <input className="form-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">부서</label>
            <input className="form-input" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">직책</label>
            <input className="form-input" value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">이메일</label>
            <input className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">전화번호</label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <button className="primary-btn" type="submit">변경사항 저장</button>
        </form>
      ) : (
        <div className="info-list">
          {isAnalyzableCard(card) && (
            <div className="card-section" style={{ marginTop: '0' }}>
              <h2 className="section-title">원본 이미지</h2>
              <img alt="Original" src={card.imageUrl} style={{ width: '100%', borderRadius: '12px', border: '1px solid var(--border)' }} />
            </div>
          )}
          <button
            className="secondary-btn"
            disabled={deletingCardId === card.id}
            onClick={async () => { if (await onDeleteCard(card.id)) navigate('/cards') }}
            style={{ color: 'var(--danger)', marginTop: '20px', width: '100%', background: '#fff0f0' }}
          >
            {deletingCardId === card.id ? '삭제 중...' : '명함 삭제하기'}
          </button>
        </div>
      )}
    </div>
  )
}

function SearchPage({ accessToken, cards }: { accessToken: string; cards: CardResponse[] }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState({ name: '', company: '', dept: '', pos: '' })
  const [results, setResults] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.name) params.set('name', query.name)
      if (query.company) params.set('company', query.company)
      if (query.dept) params.set('department', query.dept)
      if (query.pos) params.set('position', query.pos)

      const res = await apiRequest<PagedResponse<Person>>(`/api/v1/search/persons?${params.toString()}`, { accessToken })
      setResults(res.content)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ paddingTop: '20px' }}>
      <h2 className="section-title">인물 검색</h2>
      <form className="panel" onSubmit={handleSearch}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">이름</label>
            <input className="form-input" value={query.name} onChange={(e) => setQuery({ ...query, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">회사</label>
            <input className="form-input" value={query.company} onChange={(e) => setQuery({ ...query, company: e.target.value })} />
          </div>
        </div>
        <button className="primary-btn" type="submit">{loading ? '검색중...' : '검색'}</button>
      </form>

      <div style={{ marginTop: '24px' }}>
        <h3 className="section-title">검색 결과 ({results.length})</h3>
        {results.map((p) => {
          const card = cards.find((c) => c.person?.id === p.id)
          return (
            <div className="app-card" key={p.id} onClick={() => card && navigate(`/digital/${card.id}`)} style={{ cursor: card ? 'pointer' : 'default', marginBottom: '12px' }}>
              <div className="app-card-content">
                <span className="app-card-title">{p.name}</span>
                <span className="app-card-subtitle">{p.companyName} • {p.positionName}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.departmentName}</span>
              </div>
              {p.companyId && (
                <button
                  className="secondary-btn"
                  onClick={(e) => { e.stopPropagation(); navigate(`/org?companyId=${p.companyId}&personId=${p.id}`); }}
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem' }}
                >
                  조직도
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OrganizationPage({ accessToken }: { accessToken: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [companies, setCompanies] = useState<CompanyResponse[]>([])
  const [tree, setTree] = useState<OrganizationTreeResponse | null>(null)
  const selectedCompanyId = searchParams.get('companyId') || ''
  const highlightedPersonId = searchParams.get('personId') || ''

  useEffect(() => {
    void apiRequest<CompanyResponse[]>('/api/v1/companies', { accessToken }).then((res) => {
      setCompanies(res)
      if (!selectedCompanyId && res[0]) {
        setSearchParams({ companyId: String(res[0].id) })
      }
    })
  }, [accessToken])

  useEffect(() => {
    if (selectedCompanyId) {
      void apiRequest<OrganizationTreeResponse>(`/api/v1/companies/${selectedCompanyId}/tree`, { accessToken }).then(setTree)
    }
  }, [accessToken, selectedCompanyId])

  return (
    <div style={{ paddingTop: '20px' }}>
      <h2 className="section-title">조직도 탐색</h2>
      <div className="form-group">
        <select
          className="form-input"
          value={selectedCompanyId}
          onChange={(e) => setSearchParams({ companyId: e.target.value })}
        >
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {tree && (
        <div style={{ marginTop: '20px' }}>
          {tree.departments.map((dept) => (
            <OrgNode key={dept.id} highlightedId={highlightedPersonId} node={dept} />
          ))}
        </div>
      )}
    </div>
  )
}

function OrgNode({ node, highlightedId }: { node: DepartmentNode; highlightedId: string }) {
  return (
    <div style={{ marginLeft: node.depth > 1 ? '16px' : '0', marginBottom: '16px', borderLeft: '2px solid var(--border)', paddingLeft: '12px' }}>
      <div style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--primary)' }}>{node.name}</div>
      {node.persons.map((p) => (
        <div
          key={p.id}
          style={{
            padding: '8px 12px',
            background: String(p.id) === highlightedId ? 'var(--primary-light)' : 'white',
            borderRadius: '8px',
            marginBottom: '4px',
            border: '1px solid var(--border)',
            boxShadow: String(p.id) === highlightedId ? '0 0 0 2px var(--primary)' : 'none',
          }}
        >
          <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{p.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.positionName}</div>
        </div>
      ))}
      {node.children.map((child) => <OrgNode key={child.id} highlightedId={highlightedId} node={child} />)}
    </div>
  )
}

// --- Utils ---

async function fetchCards(accessToken: string) {
  return apiRequest<CardResponse[]>('/api/v1/cards', { accessToken })
}

async function apiRequest<T = undefined>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    accessToken?: string
    body?: FormData | object
  } = {},
) {
  const headers: Record<string, string> = {}
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  const res = await fetch(path, { method: options.method ?? 'GET', headers, body })
  if (res.status === 204) return undefined as T
  const data = await (res.headers.get('content-type')?.includes('json') ? res.json() : res.text())
  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null
        ? (data as { message?: string; error?: string }).message ?? (data as { message?: string; error?: string }).error ?? 'Request failed'
        : typeof data === 'string' && data.length > 0
          ? data
          : 'Request failed'
    throw new ApiRequestError(res.status, message)
  }
  return data as T
}

function getCardTitle(card: CardResponse) {
  return card.ocrResult?.name ?? card.originalFileName ?? `card-${card.id}`
}

function isAnalyzableCard(card: CardResponse) {
  return card.imageUrl.startsWith('/api/v1/files/')
}

export default App
