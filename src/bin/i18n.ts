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
  .option('--no-cache', 'Ignore file cache and rescan all files')
  .option('--logger <level>', 'Log level: none | error | warn | info')
  .option('-f, --force', 'Force re-translate all texts (ignore existing)')
  .action(async (_root: string, options: any) => {
    const { Translate } = await import('../commands/Translate')
    const translate = new Translate(options)
    translate.run()
  })

// 只扫描写语料,不调用翻译服务
cli
  .command('scan', 'Scan and write locale files without translating')
  .option('-c, --config <file>', 'use specified config file')
  .option('--no-cache', 'Ignore file cache and rescan all files')
  .option('--logger <level>', 'Log level: none | error | warn | info')
  .action(async (options: any) => {
    const { Translate } = await import('../commands/Translate')
    const translate = new Translate({ ...options, skipTranslate: true })
    translate.run()
  })

// 应用 diff.json 中用户修改后的 suggested 译文到语言包
cli
  .command('apply', 'Apply diff.json suggested translations to locale files')
  .option('-c, --config <file>', 'use specified config file')
  .option('--logger <level>', 'Log level: none | error | warn | info')
  .action(async (options: any) => {
    const { Apply } = await import('../commands/Apply')
    const apply = new Apply(options)
    apply.run()
  })

cli.parse()
