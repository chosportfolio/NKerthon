export type User = {
  id: number
  loginId: string
  name: string
  department: string
  studentNumber: string
  gender: string
  role: 'student' | 'admin'
  profileImage: string | null
}

export type SignupData = {
  loginId: string
  password: string
  name: string
  department: string
  studentNumber: string
  gender: string
}
