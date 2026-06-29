import { CommandRegistry, TuiShell } from '@dbwebb/tui'
import { KeysCommands } from './commands/keys.js'

const apiUrl = (process.env.API_URL ?? 'http://localhost:5000').replace(/\/$/, '')

console.log(`
API Key Server — administrativt CLI
Hanterar API-nycklar för studenter i MVC- och ops-kursen vid BTH.

  Server : ${apiUrl}
  Kommandon: keys list | keys create | keys show | keys revoke | keys restore
  Hjälp  : help | <kommando> <action> --help
  Avsluta: exit
`)

const registry = new CommandRegistry()
registry.register('keys', new KeysCommands())

new TuiShell(registry).start()
