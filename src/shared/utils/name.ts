const compoundSurnames = ['남궁', '황보', '제갈', '선우', '서문', '독고', '동방']

export function getGivenName(fullName: string) {
  const trimmedName = fullName.trim()
  if (trimmedName.length <= 1) return trimmedName

  const surnameLength = compoundSurnames.some((surname) => trimmedName.startsWith(surname)) ? 2 : 1
  return trimmedName.slice(surnameLength) || trimmedName
}
