import { Injectable } from '@nestjs/common'
import { machineId } from 'node-machine-id'

@Injectable()
export class AuthService {
  constructor() {}

  async getMachineId() {
    return await machineId()
  }
}
