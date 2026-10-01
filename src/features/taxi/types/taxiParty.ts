export type TaxiPartyStatus = 'open' | 'full' | 'closed'

export type TaxiParty = {
  id: number
  departure: string
  destination: string
  departureAt: string
  capacity: number
  memberCount: number
  note: string
  status: TaxiPartyStatus
  creatorName: string
  creatorDepartment: string
  isOwner: boolean
  isMember: boolean
}

export type CreateTaxiPartyData = {
  departure: string
  destination: string
  departureAt: string
  capacity: number
  note: string
}

export type TaxiPartyMessage = {
  id: number
  message: string
  createdAt: string
  senderName: string
  senderDepartment: string
  isMine: boolean
}

