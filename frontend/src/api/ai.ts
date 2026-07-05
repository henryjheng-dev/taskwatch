import api from './client'
import type { AiUsage, GenerateBoardRequest, Board } from '../types'

export const aiApi = {
  generate(data: GenerateBoardRequest) {
    return api.post<Board>('/ai/generate', data)
  },

  getUsage() {
    return api.get<AiUsage>('/ai/usage')
  },
}
