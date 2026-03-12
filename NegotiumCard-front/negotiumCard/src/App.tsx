import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './App.css'

type AuthMode = 'login' | 'signup'

type AuthResponse = {
  userId: number
  name: string
  email: string
  accessToken: string
  refreshToken: string
}

type CardResponse = {
  id: number
  imageUrl: string
  originalFileName: string | null
  status: string
  createdAt: string
}

const AUTH_STORAGE_KEY = 'negotium-auth'

function App() {
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
  const [feedback, setFeedback] = useState('앱에 로그인한 뒤 명함 이미지를 올리세요.')

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
        const text = await response.text()
        setServerStatus(text)
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

    const fetchCards = async () => {
      const response = await fetch('/api/v1/cards', {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      })

      if (response.ok) {
        const data = (await response.json()) as CardResponse[]
        setCards(data)
      }
    }

    fetchCards()
  }, [auth])

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
        body: JSON.stringify(
          authMode === 'signup'
            ? { name, email, password }
            : { email, password },
        ),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '인증 요청 실패')
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

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '업로드 실패')
      }

      const uploadedCard = data as CardResponse
      setCards((previous) => [uploadedCard, ...previous])
      setFeedback('명함 이미지가 업로드되었습니다.')
      setSelectedFile(null)
      setPreviewUrl(null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setAuth(null)
    setCards([])
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    setFeedback('로그아웃했습니다.')
  }

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <div className="phone-header">
          <div>
            <p className="eyebrow">NEGOTIUM CARD APP</p>
            <h1>명함 업로드</h1>
          </div>
          <span className={`server-badge ${serverStatus === 'server ok' ? 'online' : 'offline'}`}>
            {serverStatus}
          </span>
        </div>

        {!auth ? (
          <section className="panel auth-panel">
            <div className="auth-switch">
              <button
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => setAuthMode('login')}
                type="button"
              >
                로그인
              </button>
              <button
                className={authMode === 'signup' ? 'active' : ''}
                onClick={() => setAuthMode('signup')}
                type="button"
              >
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
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? '처리 중...' : authMode === 'login' ? '로그인' : '회원가입'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="panel profile-panel">
              <div>
                <p className="profile-name">{auth.name}</p>
                <p className="profile-email">{auth.email}</p>
              </div>
              <button className="secondary-button" onClick={handleLogout} type="button">
                로그아웃
              </button>
            </section>

            <section className="panel upload-panel">
              <div className="panel-title">
                <h2>명함 이미지 올리기</h2>
                <p>앱 화면 기준으로 바로 촬영/선택하는 자리에 해당합니다.</p>
              </div>

              <label className="upload-dropzone">
                <input accept="image/*" onChange={handleFileChange} type="file" />
                {previewUrl ? (
                  <img alt="명함 미리보기" src={previewUrl} />
                ) : (
                  <div className="upload-placeholder">
                    <strong>Tap to Upload</strong>
                    <span>PNG, JPG, HEIC 모두 가능</span>
                  </div>
                )}
              </label>

              <button
                className="primary-button"
                disabled={!selectedFile || loading}
                onClick={handleUpload}
                type="button"
              >
                {loading ? '업로드 중...' : '명함 업로드'}
              </button>
            </section>

            <section className="panel feed-panel">
              <div className="panel-title">
                <h2>최근 업로드</h2>
                <p>{cards.length}장의 명함이 등록되었습니다.</p>
              </div>

              <div className="card-feed">
                {cards.length === 0 ? (
                  <p className="empty-state">아직 업로드된 명함이 없습니다.</p>
                ) : (
                  cards.map((card) => (
                    <article className="feed-item" key={card.id}>
                      <img alt={card.originalFileName ?? '명함 이미지'} src={card.imageUrl} />
                      <div className="feed-copy">
                        <strong>{card.originalFileName ?? `card-${card.id}`}</strong>
                        <span>{card.status}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        <p className="feedback">{feedback}</p>
      </section>
    </main>
  )
}

export default App
