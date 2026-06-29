import { CommandRegistry, TuiShell } from '@dbwebb/tui'
import { KeysCommands } from './commands/keys.js'

const registry = new CommandRegistry()
registry.register('keys', new KeysCommands())

new TuiShell(registry).start()
