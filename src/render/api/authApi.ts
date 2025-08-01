import { api } from './apiClient'

export interface MachineIdResponse {
  machineId: string
}

export const authApi = {
  getMachineId: async (): Promise<MachineIdResponse> => {
    const { data } = await api.get<MachineIdResponse>('/auth/machine-id')
    return data
  },
}
