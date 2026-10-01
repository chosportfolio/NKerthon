import { useState } from 'react'
import type { FormEvent } from 'react'
import { login, saveAuthToken, signup } from '../api/authApi'
import type { SignupData, User } from '../types/auth'

type AuthScreenProps = {
  onAuthenticated: (user: User) => void
}

const initialSignupData: SignupData = {
  loginId: '',
  password: '',
  name: '',
  department: '',
  studentNumber: '',
  gender: '',
}

function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [autoLogin, setAutoLogin] = useState(false)
  const [signupData, setSignupData] = useState(initialSignupData)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const changeMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await login(loginId, password)
      saveAuthToken(result.token, autoLogin)
      onAuthenticated(result.user)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '로그인하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (signupData.password.length < 8) {
      setError('비밀번호는 8자 이상 입력해 주세요.')
      return
    }

    setSubmitting(true)

    try {
      const result = await signup(signupData)
      setLoginId(signupData.loginId)
      setPassword('')
      setSignupData(initialSignupData)
      setMode('login')
      setNotice(result.message)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '회원가입하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-brand" aria-hidden="true">
          <span>KU</span>
        </div>
        <div className="auth-heading">
          <span>건국대학교 글로컬캠퍼스</span>
          <h1 id="auth-title">{mode === 'login' ? '다시 만나서 반가워요' : '새 계정을 만들어요'}</h1>
          <p>{mode === 'login' ? '캠퍼스 생활을 한곳에서 확인하세요.' : '학생 정보를 입력하면 가입이 완료됩니다.'}</p>
        </div>

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>아이디</span>
              <input
                type="text"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                placeholder="아이디를 입력하세요"
                autoComplete="username"
                required
              />
            </label>
            <label>
              <span>비밀번호</span>
              <div className="password-field">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  autoComplete="current-password"
                  required
                />
                {password && <span className="password-mask" aria-hidden="true">{'*'.repeat(password.length)}</span>}
              </div>
            </label>
            <label className="auto-login-check">
              <input
                type="checkbox"
                checked={autoLogin}
                onChange={(event) => setAutoLogin(event.target.checked)}
              />
              <span>자동 로그인</span>
            </label>
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? '로그인 중...' : '로그인'}
            </button>
            <div className="auth-switch">
              <span>아직 계정이 없나요?</span>
              <button type="button" onClick={() => changeMode('signup')}>회원가입</button>
            </div>
          </form>
        ) : (
          <form className="auth-form signup-form" onSubmit={handleSignup}>
            <div className="auth-field-grid">
              <label>
                <span>이름</span>
                <input
                  type="text"
                  value={signupData.name}
                  onChange={(event) => setSignupData({ ...signupData, name: event.target.value })}
                  placeholder="김건국"
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                <span>학번</span>
                <input
                  type="text"
                  value={signupData.studentNumber}
                  onChange={(event) => setSignupData({ ...signupData, studentNumber: event.target.value })}
                  placeholder="202600000"
                  inputMode="numeric"
                  required
                />
              </label>
            </div>
            <label>
              <span>아이디</span>
              <input
                type="text"
                value={signupData.loginId}
                onChange={(event) => setSignupData({ ...signupData, loginId: event.target.value })}
                placeholder="영문·숫자 4자 이상"
                autoComplete="username"
                required
              />
            </label>
            <label>
              <span>비밀번호</span>
              <div className="password-field">
                <input
                  type="password"
                  value={signupData.password}
                  onChange={(event) => setSignupData({ ...signupData, password: event.target.value })}
                  placeholder="8자 이상 입력하세요"
                  autoComplete="new-password"
                  required
                />
                {signupData.password && (
                  <span className="password-mask" aria-hidden="true">
                    {'*'.repeat(signupData.password.length)}
                  </span>
                )}
              </div>
            </label>
            <label>
              <span>학과</span>
              <input
                type="text"
                value={signupData.department}
                onChange={(event) => setSignupData({ ...signupData, department: event.target.value })}
                placeholder="예: 컴퓨터공학과"
                required
              />
            </label>
            <label>
              <span>성별</span>
              <select
                value={signupData.gender}
                onChange={(event) => setSignupData({ ...signupData, gender: event.target.value })}
                required
              >
                <option value="" disabled>선택해 주세요</option>
                <option value="남성">남성</option>
                <option value="여성">여성</option>
                <option value="선택 안 함">선택 안 함</option>
              </select>
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? '저장 중...' : '회원가입'}
            </button>
            <div className="auth-switch">
              <span>이미 계정이 있나요?</span>
              <button type="button" onClick={() => changeMode('login')}>로그인하기</button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}

export default AuthScreen
