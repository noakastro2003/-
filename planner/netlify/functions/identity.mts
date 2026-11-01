// A personal app: once the first account exists, nobody else can sign up.
import { admin } from '@netlify/identity'
import type { UserValidateEvent } from '@netlify/functions'

export default {
  async userValidate(event: UserValidateEvent) {
    const users = await admin.listUsers({ perPage: 1 })
    if (users.length > 0) return event.deny()
  },
}
