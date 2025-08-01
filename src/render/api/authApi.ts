import { api } from './apiClient'

export interface MachineIdResponse {
  machineId: string
}

export interface RegisterLicenseRequest {
  license_key: string
  node_machine_id: string
}

export interface RegisterLicenseResponse {
  success: boolean
  message: string
  data?: any
}

export const authApi = {
  getMachineId: async (): Promise<MachineIdResponse> => {
    const { data } = await api.get<MachineIdResponse>('/auth/machine-id')
    return data
  },

  registerLicense: async (request: RegisterLicenseRequest): Promise<RegisterLicenseResponse> => {
    const { data } = await api.post<RegisterLicenseResponse>('/auth/register-license', request)
    return data
  },
}
