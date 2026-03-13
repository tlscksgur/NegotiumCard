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

type CardResponse = {
  id: number
  imageUrl: string
  originalFileName: string | null
  status: string
  createdAt: string
  ocrResult: OcrResult | null
}

type ApiError = {
  detail?: string
  message?: string
}

const AUTH_STORAGE_KEY = 'negotium-auth'

function getInitialBadge(name?: string | null) {
  const base = (name ?? '').trim()
  if (!base) {
    return '명'
  }

  const compact = base.replace(/\s+/g, '')
  return compact.slice(0, Math.min(2, compact.length))
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
  const [email, setEmail] = useState('tester@example.com')
  const [password, setPassword] = useState('password123')
  const [name, setName] = useState('Test User')
  const [serverStatus, setServerStatus] = useState('연결 확인 중...')
  const [cards, setCards] = useState<CardResponse[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzingCardId, setAnalyzingCardId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('앱에 로그인한 뒤 명함 이미지를 올리고 분석하세요.')

  useEffect(() => {
    const savedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (savedAuth) {
      setAuth(JSON.parse(savedAuth) as AuthResponse)
    }
  }, [])

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch('/api/test')
        setServerStatus(await response.text())
      } catch {
        setServerStatus('server offline')
      }
    }

    checkServer()
  }, [])

  useEffect(() => {
    if (!auth) {
      setCards([])
      return
    }

    void refreshCards(auth.accessToken)
  }, [auth])

  const readError = (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      const apiError = data as ApiError
      return apiError.detail ?? apiError.message ?? '요청 처리 실패'
    }
    return '요청 처리 실패'
  }

  const refreshCards = async (accessToken: string) => {
    const response = await fetch('/api/v1/cards', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = (await response.json()) as ApiError
      throw new Error(readError(error))
    }

    const data = (await response.json()) as CardResponse[]
    setCards(data)
  }

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

      const data = (await response.json()) as AuthResponse | ApiError
      if (!response.ok) {
        throw new Error(readError(data))
      }

      const nextAuth = data as AuthResponse
      setAuth(nextAuth)
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth))
      setFeedback(`${nextAuth.name} 계정으로 로그인되었습니다.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '인증 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
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

      const data = (await response.json()) as CardResponse | ApiError
      if (!response.ok) {
        throw new Error(readError(data))
      }

      await refreshCards(auth.accessToken)
      setFeedback('명함 이미지가 업로드되었습니다. 이제 분석을 실행하세요.')
      setSelectedFile(null)
      setPreviewUrl(null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.')
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
      const yoloResponse = await fetch(`/api/v1/analyze/cards/${cardId}/yolo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      })
      const yoloData = (await yoloResponse.json()) as ApiError
      if (!yoloResponse.ok) {
        throw new Error(readError(yoloData))
      }

      const ocrResponse = await fetch(`/api/v1/analyze/cards/${cardId}/ocr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      })
      const ocrData = (await ocrResponse.json()) as ApiError
      if (!ocrResponse.ok) {
        throw new Error(readError(ocrData))
      }

      await refreshCards(auth.accessToken)
      setFeedback('명함 분석이 완료되었습니다. 온라인 명함에서 결과를 확인하세요.')
      navigate(`/digital/${cardId}`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.')
    } finally {
      setAnalyzingCardId(null)
    }
  }

  const handleLogout = () => {
    setAuth(null)
    setCards([])
    setSelectedFile(null)
    setPreviewUrl(null)
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setFeedback('로그아웃했습니다.')
    navigate('/')
  }

  if (!auth) {
    return (
      <main className="app-shell">
        <section className="phone-frame auth-frame">
          <div className="phone-header">
            <div>
              <p className="eyebrow">NEGOTIUM CARD APP</p>
              <h1>명함을 온라인 카드로</h1>
            </div>
            <span className={`server-badge ${serverStatus === 'server ok' ? 'online' : 'offline'}`}>
              {serverStatus}
            </span>
          </div>

          <section className="panel hero-panel">
            <p className="hero-kicker">MOBILE WEB MVP</p>
            <h2>촬영한 명함을 올리고 조직 정보를 디지털로 관리합니다.</h2>
            <p>YOLO와 OCR 분석 결과를 바로 명함 UI로 정리하고, 보관함에서 한 번에 확인할 수 있습니다.</p>
          </section>

          <section className="panel auth-panel">
            <div className="auth-switch">
              <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')} type="button">
                로그인
              </button>
              <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')} type="button">
                회원가입
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <label>
                  이름
                  <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
              )}
              <label>
                이메일
                <input value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label>
                비밀번호
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? '처리 중...' : authMode === 'login' ? '로그인' : '회원가입'}
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
            <h1>{auth.name}의 명함함</h1>
          </div>
          <button className="secondary-button" onClick={handleLogout} type="button">
            로그아웃
          </button>
        </header>

        <nav className="tab-nav">
          <NavLink end to="/">
            업로드
          </NavLink>
          <NavLink to="/cards">보관함</NavLink>
          <NavLink to="/digital">온라인 명함</NavLink>
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
          <Route path="/digital" element={<DigitalCardPage cards={cards} />} />
          <Route path="/digital/:cardId" element={<DigitalCardPage cards={cards} />} />
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
          <p className="profile-name">최근 업로드 {cards.length}장</p>
          <p className="profile-email">업로드 후 분석을 실행하면 온라인 명함으로 변환됩니다.</p>
        </div>
      </section>

      <section className="panel upload-panel">
        <div className="panel-title">
          <h2>명함 촬영 / 업로드</h2>
          <p>모바일 앱처럼 사진을 올리고 바로 분석할 수 있습니다.</p>
        </div>

        <label className="upload-dropzone">
          <input accept="image/*" onChange={onFileChange} type="file" />
          {previewUrl ? (
            <img alt="명함 미리보기" src={previewUrl} />
          ) : (
            <div className="upload-placeholder">
              <strong>Tap to Upload</strong>
              <span>PNG, JPG, HEIC</span>
            </div>
          )}
        </label>

        <button className="primary-button" disabled={!selectedFile || loading} onClick={onUpload} type="button">
          {loading ? '업로드 중...' : '명함 업로드'}
        </button>
      </section>

      <section className="panel feed-panel">
        <div className="panel-title">
          <h2>최근 명함</h2>
          <p>분석 완료 후 온라인 명함 페이지에서 편집 전 결과를 확인합니다.</p>
        </div>

        <div className="card-feed">
          {cards.length === 0 ? (
            <p className="empty-state">아직 업로드된 명함이 없습니다.</p>
          ) : (
            cards.slice(0, 3).map((card) => (
              <article className="feed-item" key={card.id}>
                <img alt={card.originalFileName ?? '명함 이미지'} src={card.imageUrl} />
                <div className="feed-copy">
                  <strong>{card.ocrResult?.name ?? card.originalFileName ?? `card-${card.id}`}</strong>
                  <span>{card.ocrResult?.company ?? '회사 분석 전'}</span>
                  <span>{card.status}</span>
                </div>
                <div className="feed-actions">
                  <button
                    className="secondary-button"
                    disabled={analyzingCardId === card.id}
                    onClick={() => onAnalyze(card.id)}
                    type="button"
                  >
                    {analyzingCardId === card.id ? '분석 중...' : '명함 변환'}
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
          <h2>내 명함 보관함</h2>
          <p>찍어둔 명함을 한 번에 보고, 원하는 카드만 다시 분석할 수 있습니다.</p>
        </div>
      </section>

      <section className="archive-grid">
        {cards.length === 0 ? (
          <p className="empty-state panel">보관함이 비어 있습니다.</p>
        ) : (
          cards.map((card) => (
            <article className="archive-card" key={card.id}>
              <img alt={card.originalFileName ?? '명함 이미지'} src={card.imageUrl} />
              <div className="archive-copy">
                <strong>{card.ocrResult?.name ?? card.originalFileName ?? `card-${card.id}`}</strong>
                <span>{card.ocrResult?.company ?? '회사 인식 전'}</span>
                <span>{card.ocrResult?.position ?? '직책 인식 전'}</span>
              </div>
              <div className="archive-actions">
                <button
                  className="secondary-button"
                  disabled={analyzingCardId === card.id}
                  onClick={() => onAnalyze(card.id)}
                  type="button"
                >
                  {analyzingCardId === card.id ? '분석 중...' : '재분석'}
                </button>
                <Link className="inline-link" to={`/digital/${card.id}`}>
                  온라인 명함 보기
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}

function DigitalCardPage({ cards }: { cards: CardResponse[] }) {
  const { cardId } = useParams()
  const selectedCard = cards.find((card) => String(card.id) === cardId) ?? cards[0]

  if (!selectedCard) {
    return (
      <section className="panel">
        <p className="empty-state">명함을 먼저 업로드하고 분석해 주세요.</p>
      </section>
    )
  }

  const ocr = selectedCard.ocrResult

  return (
    <div className="page-stack">
      <section className="panel digital-selector-panel">
        <div className="panel-title">
          <h2>온라인 명함 목록</h2>
          <p>지금까지 올린 명함 중에서 하나를 골라 상세 명함으로 확인하세요.</p>
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
                <span>{card.ocrResult?.company ?? '회사 인식 전'}</span>
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
          <span className="chip">{ocr?.company ?? '회사 미인식'}</span>
          <span className="chip muted">{selectedCard.status}</span>
        </div>

        <div className="digital-card-main">
          <div>
            <p className="digital-label">NAME</p>
            <h2>{ocr?.name ?? '이름 인식 전'}</h2>
          </div>
          <div className="digital-meta">
            <p>{ocr?.position ?? '직책 인식 전'}</p>
            <p>{ocr?.department ?? '부서 인식 전'}</p>
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
          <h2>원본 명함</h2>
          <p>OCR 결과와 함께 비교할 수 있게 원본을 같이 보여줍니다.</p>
        </div>
        <img alt={selectedCard.originalFileName ?? '원본 명함'} className="full-card-image" src={selectedCard.imageUrl} />
      </section>

      <section className="panel raw-text-panel">
        <div className="panel-title">
          <h2>추출된 텍스트</h2>
          <p>OCR 원문입니다. 이후 수정 기능으로 연결할 수 있습니다.</p>
        </div>
        <pre>{ocr?.rawText ?? '아직 OCR 결과가 없습니다.'}</pre>
      </section>
    </div>
  )
}

export default App
