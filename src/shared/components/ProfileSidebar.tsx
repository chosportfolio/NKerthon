import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { User } from '../../features/auth/types/auth'

type ProfileSidebarProps = {
  user: User
  onClose: () => void
  onLogout: () => void
  onProfileImageChange: (profileImage: string) => Promise<void>
}

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const imageUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(imageUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error('이미지를 불러오지 못했습니다.'))
    }
    image.src = imageUrl
  })

async function optimizeProfileImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('JPG, PNG 또는 WebP 이미지를 선택해 주세요.')
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('10MB 이하 이미지를 선택해 주세요.')
  }

  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const outputSize = 512
  const cropSize = Math.min(image.naturalWidth, image.naturalHeight)
  const sourceX = (image.naturalWidth - cropSize) / 2
  const sourceY = (image.naturalHeight - cropSize) / 2

  if (!context) throw new Error('이미지를 처리하지 못했습니다.')

  canvas.width = outputSize
  canvas.height = outputSize
  context.fillStyle = '#f3f8f4'
  context.fillRect(0, 0, outputSize, outputSize)
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    outputSize,
    outputSize,
  )

  return canvas.toDataURL('image/jpeg', 0.86)
}

function ProfileSidebar({
  user,
  onClose,
  onLogout,
  onProfileImageChange,
}: ProfileSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setUploading(true)

    try {
      const profileImage = await optimizeProfileImage(file)
      await onProfileImageChange(profileImage)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '이미지를 변경하지 못했습니다.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="profile-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="profile-sidebar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-sidebar-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="profile-sidebar-header">
          <strong id="profile-sidebar-title">내 프로필</strong>
          <button type="button" onClick={onClose} aria-label="프로필 닫기">×</button>
        </div>

        <div className="profile-card">
          <div className="profile-avatar-large">
            {user.profileImage ? (
              <img src={user.profileImage} alt={`${user.name} 프로필`} />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
              </svg>
            )}
          </div>
          <h2>{user.name}</h2>
          <p>{user.department}</p>
          <span>{user.studentNumber}</span>
          {user.role === 'admin' && <em>관리자</em>}

          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
          />
          <button
            className="profile-image-button"
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? '사진 저장 중...' : '프로필 이미지 변경'}
          </button>
          {error && <p className="profile-upload-error" role="alert">{error}</p>}
        </div>

        <button className="logout-button" type="button" onClick={onLogout}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
          </svg>
          로그아웃
        </button>
      </aside>
    </div>
  )
}

export default ProfileSidebar
