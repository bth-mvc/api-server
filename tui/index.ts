import { CommandRegistry, TuiShell } from '@dbwebb/tui'
import { KeysCommands } from './commands/keys.js'

const apiUrl = (process.env.API_URL ?? 'http://localhost:5000').replace(/\/$/, '')

const registry = new CommandRegistry()
registry.register('keys', new KeysCommands())

new TuiShell(registry, {
  welcomeMessage: `API Key Server — administrativt CLI
Hanterar API-nycklar för studenter i MVC- och ops-kursen vid BTH.

  Server : ${apiUrl}
  Kommandon: health | list | create | show | revoke | restore`,
  defaultGroup: 'keys',
}).start()
