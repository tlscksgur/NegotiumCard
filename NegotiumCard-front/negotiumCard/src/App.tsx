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

type DepartmentResponse = {
  id: number
  name: string
  depth: number
  companyId: number | null
  parentId: number | null
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

type OcrUpdateRequest = {
  rawText?: string | null
  name?: string | null
  company?: string | null
  department?: string | null
  position?: string | null
  email?: string | null
  phone?: string | null
}

type ApiError = {
  detail?: string
  message?: string
  error?: string
  timestamp?: string
}

const AUTH_STORAGE_KEY = 'negotium-auth'

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
  const [name, setName] = useState('테스트 사용자')
  const [email, setEmail] = useState('tester@example.com')
  const [password, setPassword] = useState('password123')
  const [serverStatus, setServerStatus] = useState('서버 확인 중...')
  const [cards, setCards] = useState<CardResponse[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzingCardId, setAnalyzingCardId] = useState<number | null>(null)
  const [deletingCardId, setDeletingCardId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('로그인하거나 회원가입해서 명함 아카이브 관리를 시작하세요.')

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
        setServerStatus(text || '서버 정상')
      } catch {
        setServerStatus('서버 오프라인')
      }
    }

    void checkServer()
  }, [])

  useEffect(() => {
    if (!auth) {
      setCards([])
      return
    }

    void fetchCards(auth.accessToken)
      .then((response) => setCards(response))
      .catch((error: unknown) => {
        setFeedback(error instanceof Error ? error.message : '명함 목록을 불러오지 못했습니다.')
      })
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
      const payload = await apiRequest<AuthResponse>(`/api/v1/auth/${authMode}`, {
        method: 'POST',
        body: authMode === 'signup' ? { name, email, password } : { email, password },
      })

      setAuth(payload)
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      setFeedback(`${payload.name}님으로 로그인되었습니다.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '인증에 실패했습니다.')
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

      await apiRequest<CardResponse>('/api/v1/cards/image', {
        method: 'POST',
        accessToken: auth.accessToken,
        body: formData,
      })

      await refreshCards()
      setFeedback('명함 이미지가 업로드되었습니다.')
      setSelectedFile(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '업로드에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateManualCard = async (request: ManualCardRequest) => {
    if (!auth) {
      return null
    }

    setLoading(true)
    setFeedback('')

    try {
      const card = await apiRequest<CardResponse>('/api/v1/cards/manual', {
        method: 'POST',
        accessToken: auth.accessToken,
        body: request,
      })

      await refreshCards()
      setFeedback('수기 명함이 저장되었습니다.')
      navigate(`/digital/${card.id}`)
      return card
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '수기 명함 저장에 실패했습니다.')
      return null
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
      await apiRequest<CardResponse>(`/api/v1/cards/${cardId}/analyze`, {
        method: 'POST',
        accessToken: auth.accessToken,
      })

      await refreshCards()
      setFeedback('분석이 완료되었습니다.')
      navigate(`/digital/${cardId}`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '분석에 실패했습니다.')
    } finally {
      setAnalyzingCardId(null)
    }
  }

  const handleDeleteCard = async (cardId: number) => {
    if (!auth) {
      return false
    }

    setDeletingCardId(cardId)
    setFeedback('')

    try {
      await apiRequest(`/api/v1/cards/${cardId}`, {
        method: 'DELETE',
        accessToken: auth.accessToken,
      })
      await refreshCards()
      setFeedback('명함이 삭제되었습니다.')
      return true
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '삭제에 실패했습니다.')
      return false
    } finally {
      setDeletingCardId(null)
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
    setFeedback('로그아웃되었습니다.')
    navigate('/')
  }

  const refreshCards = async () => {
    if (!auth) {
      return
    }

    try {
      setCards(await fetchCards(auth.accessToken))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '명함 목록을 불러오지 못했습니다.')
    }
  }

  if (!auth) {
    return (
      <main className="app-shell">
        <section className="phone-frame auth-frame">
          <div className="phone-header">
            <div>
              <p className="eyebrow">NEGOTIUM CARD</p>
              <h1>명함 관리의 새로운 기준</h1>
            </div>
            <span className={`server-badge ${serverStatus === 'server ok' || serverStatus === '서버 정상' ? 'online' : 'offline'}`}>{serverStatus}</span>
          </div>

          <section className="panel hero-panel">
            <p className="hero-kicker">SMART ARCHIVE</p>
            <h2>명함 등록부터 조직도 연결까지 한 번에.</h2>
            <p>이미지 인식(OCR)과 AI 분석을 통해 비즈니스 인맥을 체계적으로 관리하세요.</p>
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
            <p className="feedback">개발용 기본 계정: `tester@example.com` / `password123`</p>
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
            <h1>{auth.name}님의 명함함</h1>
          </div>
          <button className="secondary-button" onClick={handleLogout} type="button">
            로그아웃
          </button>
        </header>

        <nav className="tab-nav">
          <NavLink end to="/">
            등록
          </NavLink>
          <NavLink to="/cards">명함</NavLink>
          <NavLink to="/search">검색</NavLink>
          <NavLink to="/org">조직도</NavLink>
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
                onCreateManualCard={handleCreateManualCard}
                onFileChange={handleFileChange}
                onUpload={handleUpload}
              />
            }
          />
          <Route
            path="/cards"
            element={
              <ArchivePage
                cards={cards}
                analyzingCardId={analyzingCardId}
                deletingCardId={deletingCardId}
                onAnalyze={handleAnalyzeCard}
                onDeleteCard={handleDeleteCard}
              />
            }
          />
          <Route path="/search" element={<SearchPage accessToken={auth.accessToken} cards={cards} />} />
          <Route path="/org" element={<OrganizationPage accessToken={auth.accessToken} />} />
          <Route
            path="/digital"
            element={
              <DigitalCardPage
                accessToken={auth.accessToken}
                cards={cards}
                deletingCardId={deletingCardId}
                onDeleteCard={handleDeleteCard}
                onRefreshCards={refreshCards}
              />
            }
          />
          <Route
            path="/digital/:cardId"
            element={
              <DigitalCardPage
                accessToken={auth.accessToken}
                cards={cards}
                deletingCardId={deletingCardId}
                onDeleteCard={handleDeleteCard}
                onRefreshCards={refreshCards}
              />
            }
          />
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
  onCreateManualCard,
  onFileChange,
  onUpload,
}: {
  cards: CardResponse[]
  previewUrl: string | null
  selectedFile: File | null
  loading: boolean
  analyzingCardId: number | null
  onAnalyze: (cardId: number) => void
  onCreateManualCard: (request: ManualCardRequest) => Promise<CardResponse | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUpload: () => void
}) {
  const [manualOpen, setManualOpen] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualCompany, setManualCompany] = useState('')
  const [manualDepartment, setManualDepartment] = useState('')
  const [manualPosition, setManualPosition] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualRawText, setManualRawText] = useState('')
  const [manualStatus, setManualStatus] = useState('')
  const imageCardCount = cards.filter((card) => isAnalyzableCard(card)).length
  const manualCardCount = cards.length - imageCardCount

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setManualStatus('')

    const card = await onCreateManualCard({
      originalFileName: 'manual-entry',
      rawText: toNullable(manualRawText),
      name: manualName.trim(),
      company: manualCompany.trim(),
      department: toNullable(manualDepartment),
      position: toNullable(manualPosition),
      email: toNullable(manualEmail),
      phone: toNullable(manualPhone),
    })

    if (!card) {
      setManualStatus('수기 명함 저장에 실패했습니다.')
      return
    }

    setManualName('')
    setManualCompany('')
    setManualDepartment('')
    setManualPosition('')
    setManualEmail('')
    setManualPhone('')
    setManualRawText('')
    setManualStatus('수기 명함이 저장되었습니다.')
    setManualOpen(false)
  }

  return (
    <div className="page-stack">
      <section className="panel profile-panel">
        <div className="profile-copy">
          <p className="profile-name">명함 보관함 통계</p>
          <p className="profile-email">이미지 업로드를 통해 명함을 등록하고 필요시 수기로 보조 입력할 수 있습니다.</p>
        </div>
        <div className="profile-stats">
          <div className="stat-chip">
            <strong>{cards.length}</strong>
            <span>전체</span>
          </div>
          <div className="stat-chip">
            <strong>{imageCardCount}</strong>
            <span>이미지</span>
          </div>
          <div className="stat-chip">
            <strong>{manualCardCount}</strong>
            <span>수기</span>
          </div>
        </div>
      </section>

      <section className="panel upload-panel">
        <div className="upload-hero">
          <div className="panel-title">
            <p className="hero-kicker">QUICK UPLOAD</p>
            <h2>명함 이미지 업로드</h2>
            <p>사진을 올리면 실시간 OCR 분석과 회사 매칭이 시작됩니다.</p>
          </div>
        </div>

        <label className="upload-dropzone">
          <input accept="image/*" onChange={onFileChange} type="file" />
          {previewUrl ? (
            <img alt="명함 미리보기" src={previewUrl} />
          ) : (
            <div className="upload-placeholder">
              <strong>이미지를 드래그하거나 선택하세요</strong>
              <span>JPG, PNG, WEBP 포맷을 지원합니다.</span>
            </div>
          )}
        </label>

        <div className="upload-actions">
          <button className="primary-button" disabled={!selectedFile || loading} onClick={onUpload} type="button">
            {loading ? '업로드 중...' : '명함 업로드 시작'}
          </button>
        </div>
      </section>

      <section className="panel manual-panel">
        <div className="manual-panel-header">
          <div className="panel-title">
            <h2>직접 등록</h2>
            <p>이미지가 없을 때만 쓰는 보조 입력입니다. 필요한 경우에만 펼쳐서 저장하세요.</p>
          </div>
          <button className="secondary-button manual-toggle-button" onClick={() => setManualOpen((current) => !current)} type="button">
            {manualOpen ? '입력 닫기' : '직접 입력 열기'}
          </button>
        </div>

        <div className="manual-summary">
          <span>업로드가 어려운 상황에서 이름, 회사, 연락처만 빠르게 저장할 수 있습니다.</span>
        </div>

        {manualOpen ? (
          <form className="editor-grid editor-grid-compact" onSubmit={handleManualSubmit}>
            <label>
              이름
              <input required value={manualName} onChange={(event) => setManualName(event.target.value)} />
            </label>
            <label>
              회사
              <input required value={manualCompany} onChange={(event) => setManualCompany(event.target.value)} />
            </label>
            <label>
              부서
              <input value={manualDepartment} onChange={(event) => setManualDepartment(event.target.value)} />
            </label>
            <label>
              직책
              <input value={manualPosition} onChange={(event) => setManualPosition(event.target.value)} />
            </label>
            <label>
              이메일
              <input value={manualEmail} onChange={(event) => setManualEmail(event.target.value)} />
            </label>
            <label>
              전화번호
              <input value={manualPhone} onChange={(event) => setManualPhone(event.target.value)} />
            </label>
            <label className="full-span">
              원본 텍스트
              <textarea rows={3} value={manualRawText} onChange={(event) => setManualRawText(event.target.value)} />
            </label>
            <button className="primary-button full-span" disabled={loading} type="submit">
              {loading ? '저장 중...' : '직접 등록 저장'}
            </button>
          </form>
        ) : null}
        {manualStatus ? <p className="feedback">{manualStatus}</p> : null}
      </section>

      <section className="panel feed-panel">
        <div className="panel-title">
          <h2>최근 명함</h2>
          <p>업로드한 명함을 분석하거나 상세 편집으로 바로 이동할 수 있습니다.</p>
        </div>

        <div className="card-feed">
          {cards.length === 0 ? (
            <p className="empty-state">아직 등록된 명함이 없습니다.</p>
          ) : (
            cards.slice(0, 3).map((card) => (
              <article className="feed-item" key={card.id}>
                <CardThumbnail card={card} />
                <div className="feed-copy">
                  <strong>{getCardTitle(card)}</strong>
                  <span>{card.ocrResult?.company ?? '회사 정보 없음'}</span>
                  <span>{card.ocrResult?.position ?? card.status}</span>
                </div>
                <div className="feed-actions">
                  {isAnalyzableCard(card) ? (
                    <button className="secondary-button" disabled={analyzingCardId === card.id} onClick={() => onAnalyze(card.id)} type="button">
                      {analyzingCardId === card.id ? '분석 중...' : '분석'}
                    </button>
                  ) : (
                    <span className="inline-pill">직접 등록</span>
                  )}
                  <Link className="inline-link" to={`/digital/${card.id}`}>
                    명함 보기
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>내가 저장한 명함</h2>
          <p>현재 계정으로 저장한 명함만 모아서 확인할 수 있습니다.</p>
        </div>

        <div className="result-list">
          {cards.length === 0 ? (
            <p className="empty-state">저장한 명함이 없습니다.</p>
          ) : (
            cards.map((card) => (
              <article className="result-card" key={`saved-${card.id}`}>
                <div className="result-copy">
                  <strong>{getCardTitle(card)}</strong>
                  <span>{card.ocrResult?.company ?? '회사 정보 없음'}</span>
                  <span>{card.ocrResult?.department ?? '부서 정보 없음'}</span>
                  <span>{getCardStatusLabel(card.status)}</span>
                </div>
                <div className="result-actions">
                  <span className="inline-pill">{isAnalyzableCard(card) ? '이미지 명함' : '직접 등록'}</span>
                  <Link className="inline-link" to={`/digital/${card.id}`}>
                    명함 보기
                  </Link>
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
  analyzingCardId,
  deletingCardId,
  onAnalyze,
  onDeleteCard,
}: {
  cards: CardResponse[]
  analyzingCardId: number | null
  deletingCardId: number | null
  onAnalyze: (cardId: number) => void
  onDeleteCard: (cardId: number) => Promise<boolean>
}) {
  return (
    <div className="page-stack">
      <section className="panel archive-intro">
        <div className="panel-title">
          <h2>명함 보관함</h2>
          <p>등록된 명함을 확인하고, 수정하고, 재분석하거나 삭제할 수 있습니다.</p>
        </div>
      </section>

      <section className="archive-grid">
        {cards.length === 0 ? (
          <p className="empty-state panel">보관된 명함이 없습니다.</p>
        ) : (
          cards.map((card) => (
            <article className="archive-card" key={card.id}>
              <CardThumbnail card={card} />
              <div className="archive-copy">
                <strong>{getCardTitle(card)}</strong>
                <span>{card.ocrResult?.company ?? '회사 정보 없음'}</span>
                <span>{card.ocrResult?.department ?? '부서 정보 없음'}</span>
              </div>
              <div className="archive-actions">
                {isAnalyzableCard(card) ? (
                  <button className="secondary-button" disabled={analyzingCardId === card.id} onClick={() => onAnalyze(card.id)} type="button">
                    {analyzingCardId === card.id ? '분석 중...' : '분석'}
                  </button>
                ) : (
                  <span className="inline-pill">직접 등록</span>
                )}
                <Link className="inline-link" to={`/digital/${card.id}`}>
                  명함 수정
                </Link>
                <button className="danger-button" disabled={deletingCardId === card.id} onClick={() => void onDeleteCard(card.id)} type="button">
                  {deletingCardId === card.id ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}

function SearchPage({
  accessToken,
  cards,
}: {
  accessToken: string
  cards: CardResponse[]
}) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [department, setDepartment] = useState('')
  const [position, setPosition] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('이름, 회사, 부서, 직책으로 검색하세요.')
  const [persons, setPersons] = useState<Person[]>([])
  const [companies, setCompanies] = useState<CompanyResponse[]>([])
  const [departments, setDepartments] = useState<DepartmentResponse[]>([])

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const keyword = firstNonEmpty(company, department, name, position)

    try {
      const personParams = new URLSearchParams()
      if (name.trim()) {
        personParams.set('name', name.trim())
      }
      if (company.trim()) {
        personParams.set('company', company.trim())
      }
      if (department.trim()) {
        personParams.set('department', department.trim())
      }
      if (position.trim()) {
        personParams.set('position', position.trim())
      }

      const [personResponse, companyResponse, departmentResponse] = await Promise.all([
        apiRequest<PagedResponse<Person>>(`/api/v1/search/persons?${personParams.toString()}`, {
          accessToken,
        }),
        keyword
          ? apiRequest<PagedResponse<CompanyResponse>>(`/api/v1/search/companies?keyword=${encodeURIComponent(keyword)}`, {
              accessToken,
            })
          : Promise.resolve({ content: [], page: 0, size: 0, totalElements: 0, totalPages: 0 }),
        keyword
          ? apiRequest<PagedResponse<DepartmentResponse>>(`/api/v1/search/departments?keyword=${encodeURIComponent(keyword)}`, {
              accessToken,
            })
          : Promise.resolve({ content: [], page: 0, size: 0, totalElements: 0, totalPages: 0 }),
      ])

      setPersons(personResponse.content)
      setCompanies(companyResponse.content)
      setDepartments(departmentResponse.content)

      if (personResponse.content.length === 0 && companyResponse.content.length === 0 && departmentResponse.content.length === 0) {
        setMessage('검색 결과가 없습니다.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '검색에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const openOrganization = (person: Person) => {
    if (!person.companyId) {
      return
    }
    navigate(`/org?companyId=${person.companyId}&personId=${person.id}`)
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-title">
          <h2>검색</h2>
          <p>한 화면에서 인물, 회사, 부서를 함께 검색합니다.</p>
        </div>

        <form className="editor-grid" onSubmit={handleSearch}>
          <label>
            이름
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            회사
            <input value={company} onChange={(event) => setCompany(event.target.value)} />
          </label>
          <label>
            부서
            <input value={department} onChange={(event) => setDepartment(event.target.value)} />
          </label>
          <label>
            직책
            <input value={position} onChange={(event) => setPosition(event.target.value)} />
          </label>
          <button className="primary-button full-span" disabled={loading} type="submit">
            {loading ? '검색 중...' : '검색'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>인물</h2>
          <p>입력한 조건에 맞는 인물 목록입니다.</p>
        </div>

        <div className="result-list">
          {persons.length === 0 ? (
            <p className="empty-state">{message}</p>
          ) : (
            persons.map((person) => {
              const card = cards.find((item) => item.person?.id === person.id)
              return (
                <article className="result-card" key={person.id}>
                  <div className="result-copy">
                    <strong>{person.name ?? '이름 미확인'}</strong>
                    <span>{person.companyName ?? '-'}</span>
                    <span>{person.departmentName ?? '-'}</span>
                    <span>{person.positionName ?? '-'}</span>
                  </div>
                  <div className="result-actions">
                    {card ? (
                      <Link className="inline-link" to={`/digital/${card.id}`}>
                        명함 보기
                      </Link>
                    ) : (
                      <span className="inline-pill">연결된 명함 없음</span>
                    )}
                    {person.companyId ? (
                      <button className="secondary-button" onClick={() => openOrganization(person)} type="button">
                        조직도 보기
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>회사</h2>
          <p>회사 검색 결과입니다.</p>
        </div>
        <div className="result-list">
          {companies.length === 0 ? (
            <p className="empty-state">회사 검색 결과가 없습니다.</p>
          ) : (
            companies.map((item) => (
              <article className="result-card" key={item.id}>
                <div className="result-copy">
                  <strong>{item.name}</strong>
                  <span>{item.normalizedName ?? '-'}</span>
                </div>
                <div className="result-actions">
                  <Link className="inline-link" to={`/org?companyId=${item.id}`}>
                    조직도 보기
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>부서</h2>
          <p>부서 검색 결과입니다.</p>
        </div>
        <div className="result-list">
          {departments.length === 0 ? (
            <p className="empty-state">부서 검색 결과가 없습니다.</p>
          ) : (
            departments.map((item) => (
              <article className="result-card" key={item.id}>
                <div className="result-copy">
                  <strong>{item.name}</strong>
                  <span>깊이 {item.depth}</span>
                </div>
                <div className="result-actions">
                  {item.companyId ? (
                    <Link className="inline-link" to={`/org?companyId=${item.companyId}`}>
                      조직도 보기
                    </Link>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function OrganizationPage({ accessToken }: { accessToken: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [companies, setCompanies] = useState<CompanyResponse[]>([])
  const [tree, setTree] = useState<OrganizationTreeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('회사를 선택하면 조직도를 볼 수 있습니다.')

  const searchKey = searchParams.toString()
  const selectedCompanyId = searchParams.get('companyId') ?? ''
  const highlightedPersonId = searchParams.get('personId') ?? ''

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await apiRequest<CompanyResponse[]>('/api/v1/companies', { accessToken })
        setCompanies(response)

        if (!selectedCompanyId && response[0]) {
          const next = new URLSearchParams(searchParams)
          next.set('companyId', String(response[0].id))
          setSearchParams(next)
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '회사 목록을 불러오지 못했습니다.')
      }
    }

    void loadCompanies()
  }, [accessToken, searchKey, searchParams, selectedCompanyId, setSearchParams])

  useEffect(() => {
    if (!selectedCompanyId) {
      setTree(null)
      return
    }

    const loadTree = async () => {
      setLoading(true)
      setMessage('')

      try {
        const response = await apiRequest<OrganizationTreeResponse>(`/api/v1/companies/${selectedCompanyId}/tree`, {
          accessToken,
        })
        setTree(response)
        if (response.departments.length === 0) {
          setMessage('이 회사에는 아직 등록된 부서가 없습니다.')
        }
      } catch (error) {
        setTree(null)
        setMessage(error instanceof Error ? error.message : '조직도를 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void loadTree()
  }, [accessToken, selectedCompanyId])

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-title">
          <h2>조직도</h2>
          <p>회사 계층 구조를 보고 인물을 맥락 안에서 확인할 수 있습니다.</p>
        </div>

        <label className="select-label">
          회사
          <select
            value={selectedCompanyId}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams)
              if (event.target.value) {
                next.set('companyId', event.target.value)
              } else {
                next.delete('companyId')
              }
              next.delete('personId')
              setSearchParams(next)
            }}
          >
            {companies.length === 0 ? <option value="">등록된 회사 없음</option> : null}
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>{tree?.companyName ?? '조직도'}</h2>
          <p>{loading ? '조직도 불러오는 중...' : '부서 계층과 소속 인물'}</p>
        </div>

        {!tree || tree.departments.length === 0 ? (
          <p className="empty-state">{message}</p>
        ) : (
          <div className="org-tree">
            {tree.departments.map((node) => (
              <OrganizationNodeView key={node.id} highlightedPersonId={highlightedPersonId} node={node} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function OrganizationNodeView({
  node,
  highlightedPersonId,
}: {
  node: DepartmentNode
  highlightedPersonId: string
}) {
  return (
    <div className="org-node">
      <div className="org-node-header">
        <strong>{node.name}</strong>
        <span>깊이 {node.depth}</span>
      </div>

      {node.persons.length > 0 ? (
        <div className="org-people">
          {node.persons.map((person) => (
            <div className={`org-person ${String(person.id) === highlightedPersonId ? 'highlighted' : ''}`} key={person.id}>
              <strong>{person.name ?? '이름 미확인'}</strong>
              <span>{person.positionName ?? '-'}</span>
              <span>{person.email ?? person.phone ?? '-'}</span>
            </div>
          ))}
        </div>
      ) : null}

      {node.children.length > 0 ? (
        <div className="org-children">
          {node.children.map((child) => (
            <OrganizationNodeView highlightedPersonId={highlightedPersonId} key={child.id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DigitalCardPage({
  accessToken,
  cards,
  deletingCardId,
  onDeleteCard,
  onRefreshCards,
}: {
  accessToken: string
  cards: CardResponse[]
  deletingCardId: number | null
  onDeleteCard: (cardId: number) => Promise<boolean>
  onRefreshCards: () => Promise<void>
}) {
  const navigate = useNavigate()
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
  }, [selectedCard?.id, selectedCard?.ocrResult])

  const handleSaveOcr = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedCard) {
      return
    }

    setSaving(true)
    setStatus('')

    try {
      await apiRequest<CardResponse>(`/api/v1/cards/${selectedCard.id}/ocr`, {
        method: 'PATCH',
        accessToken,
        body: {
          rawText: toNullable(rawText),
          name: toNullable(name),
          company: toNullable(company),
          department: toNullable(department),
          position: toNullable(position),
          email: toNullable(email),
          phone: toNullable(phone),
        } satisfies OcrUpdateRequest,
      })

      await onRefreshCards()
      setStatus('명함 정보가 저장되었습니다.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '명함 정보 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedCard) {
      return
    }

    const deleted = await onDeleteCard(selectedCard.id)
    if (deleted) {
      navigate('/cards')
    }
  }

  if (!selectedCard) {
    return (
      <section className="panel">
        <p className="empty-state">먼저 명함을 등록한 뒤 상세 화면을 열어주세요.</p>
      </section>
    )
  }

  const ocr = selectedCard.ocrResult

  return (
    <div className="page-stack">
      <section className="panel digital-selector-panel">
        <div className="panel-title">
          <h2>명함 상세</h2>
          <p>명함을 선택하고 추출된 항목을 수정할 수 있습니다.</p>
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
                  <strong>{getCardTitle(card)}</strong>
                  <em>{card.ocrResult?.position ?? card.status}</em>
                </div>
                <span>{card.ocrResult?.company ?? '회사 정보 없음'}</span>
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
          <span className="chip">{ocr?.company ?? '회사 미확인'}</span>
          <span className="chip muted">{isAnalyzableCard(selectedCard) ? '업로드' : '직접 등록'}</span>
        </div>

        <div className="digital-card-main">
          <div>
            <p className="digital-label">이름</p>
            <h2>{ocr?.name ?? '이름 미확인'}</h2>
          </div>
          <div className="digital-meta">
            <p>{ocr?.position ?? '직책 미확인'}</p>
            <p>{ocr?.department ?? '부서 미확인'}</p>
          </div>
        </div>

        <div className="digital-card-bottom">
          <div>
            <span>이메일</span>
            <strong>{ocr?.email ?? '-'}</strong>
          </div>
          <div>
            <span>전화번호</span>
            <strong>{ocr?.phone ?? '-'}</strong>
          </div>
        </div>

        <div className="digital-card-details">
          <div>
            <span>회사</span>
            <strong>{ocr?.company ?? '-'}</strong>
          </div>
          <div>
            <span>부서</span>
            <strong>{ocr?.department ?? '-'}</strong>
          </div>
          <div>
            <span>직책</span>
            <strong>{ocr?.position ?? '-'}</strong>
          </div>
          <div>
            <span>파일</span>
            <strong>{selectedCard.originalFileName ?? `card-${selectedCard.id}`}</strong>
          </div>
        </div>
      </section>

      <section className="panel image-panel">
        <div className="panel-title">
          <h2>명함 이미지</h2>
          <p>{isAnalyzableCard(selectedCard) ? '업로드한 원본 이미지입니다.' : '직접 등록 명함은 기본 이미지를 사용합니다.'}</p>
        </div>
        <CardThumbnail card={selectedCard} className="full-card-image" />
      </section>

      <section className="panel raw-text-panel">
        <div className="panel-title">
          <h2>명함 정보 수정</h2>
          <p>항목을 수정하면 조직 동기화도 함께 다시 계산됩니다.</p>
        </div>
        <form className="editor-grid" onSubmit={handleSaveOcr}>
          <label className="full-span">
            원본 텍스트
            <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={6} />
          </label>
          <label>
            이름
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            회사
            <input value={company} onChange={(event) => setCompany(event.target.value)} />
          </label>
          <label>
            부서
            <input value={department} onChange={(event) => setDepartment(event.target.value)} />
          </label>
          <label>
            직책
            <input value={position} onChange={(event) => setPosition(event.target.value)} />
          </label>
          <label>
            이메일
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            전화번호
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button className="primary-button full-span" disabled={saving} type="submit">
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
          <button className="danger-button full-span" disabled={deletingCardId === selectedCard.id} onClick={handleDelete} type="button">
            {deletingCardId === selectedCard.id ? '삭제 중...' : '명함 삭제'}
          </button>
        </form>
        <p className="feedback">{status || '항목을 수정한 뒤 저장하세요.'}</p>
      </section>
    </div>
  )
}

function CardThumbnail({ card, className }: { card: CardResponse; className?: string }) {
  if (!isAnalyzableCard(card)) {
    return (
      <div className={`card-placeholder-thumbnail ${className ?? ''}`.trim()}>
        <strong>직접 등록 명함</strong>
        <span>업로드된 이미지 없음</span>
      </div>
    )
  }

  return <img alt={card.originalFileName ?? '명함 이미지'} className={className} src={card.imageUrl} />
}

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
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await parseMaybeJson(response)
  if (!response.ok) {
    throw new Error(getErrorMessage(payload))
  }

  return payload as T
}

async function parseMaybeJson(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

function getErrorMessage(data: unknown) {
  if (typeof data === 'string') {
    return data
  }

  if (typeof data === 'object' && data !== null) {
    const apiError = data as ApiError
    return apiError.detail ?? apiError.message ?? apiError.error ?? '요청에 실패했습니다.'
  }

  return '요청에 실패했습니다.'
}

function getCardTitle(card: CardResponse) {
  return card.ocrResult?.name ?? card.originalFileName ?? `card-${card.id}`
}

function getCardStatusLabel(status: string) {
  switch (status) {
    case 'UPLOADED':
      return '업로드 완료'
    case 'ANALYZING':
      return '분석 중'
    case 'ANALYZED':
      return '분석 완료'
    case 'FAILED':
      return '분석 실패'
    default:
      return status
  }
}

function getInitialBadge(name?: string | null) {
  const base = (name ?? '').trim()
  if (!base) {
    return 'NC'
  }

  const compact = base.replace(/\s+/g, '')
  return compact.slice(0, Math.min(2, compact.length)).toUpperCase()
}

function toNullable(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function firstNonEmpty(...values: string[]) {
  return values.map((value) => value.trim()).find((value) => value.length > 0) ?? ''
}

function isAnalyzableCard(card: CardResponse) {
  return card.imageUrl.startsWith('/api/v1/files/')
}

export default App
