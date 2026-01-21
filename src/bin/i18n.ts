import cac from 'cac'

const cli = cac('i18n')

cli.version(__VERSION__)
cli.help()

// 初始化配置文件
cli
  .command('init', 'Init i18n config file')
  .option('-f, --force', 'Force init i18n config file')
  .option('-c, --config <file>', 'use specified config file')
  .action(async (options) => {
    const { InitConfig } = await import('../commands/InitConfig')
    const init = new InitConfig(options)
    init.run()
  })

// 翻译文件
cli
  .command('[root]', 'Translate i18n files')
  .alias('translate')
  .option('-c, --config <file>', 'use specified config file')
  .action(async (_root: string, options: any) => {
    const { Translate } = await import('../commands/Translate')
    const translate = new Translate(options)
    translate.run()
  })

cli.parse()
