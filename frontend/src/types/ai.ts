export interface AiUsage {
  used: number
  remaining: number
  limit: number
  resetsIn: number
}

export interface GenerateBoardRequest {
  prompt: string
}
