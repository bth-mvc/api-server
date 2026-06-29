declare module '@dbwebb/tui' {
  export class BaseCommand {
    publicMethods(): string[]
    help(): string
  }

  export class CommandRegistry {
    register(name: string, instance: BaseCommand): void
    dispatch(tokens: string[]): Promise<{ ok: boolean; message: string }>
  }

  export class TuiShell {
    constructor(registry: CommandRegistry)
    start(): void
  }
}
