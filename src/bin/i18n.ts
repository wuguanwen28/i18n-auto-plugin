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

// 语料体检:报告死键、缺失翻译、覆盖率(只读)
cli
  .command('check', 'Check locale health: dead keys, missing translations, coverage')
  .option('-c, --config <file>', 'use specified config file')
  .option('--logger <level>', 'Log level: none | error | warn | info')
  .action(async (options: any) => {
    const { Check } = await import('../commands/Check')
    const check = new Check(options)
    check.run()
  })

// 清理死键:确认后从语言包删除代码中已删除的文案
cli
  .command('prune', 'Remove dead keys (deleted from code) from locale files')
  .option('-c, --config <file>', 'use specified config file')
  .option('--logger <level>', 'Log level: none | error | warn | info')
  .action(async (options: any) => {
    const { Prune } = await import('../commands/Prune')
    const prune = new Prune(options)
    prune.run()
  })

// 导出语言包为 CSV,交给翻译人员校对
cli
  .command('export', 'Export locale to CSV for translators')
  .option('-o, --out <file>', 'output CSV path (default: <output.dir>/i18n.csv)')
  .option('--missing', 'only export rows with missing translations')
  .option('-c, --config <file>', 'use specified config file')
  .option('--logger <level>', 'Log level: none | error | warn | info')
  .action(async (options: any) => {
    const { Export } = await import('../commands/Export')
    const exp = new Export(options)
    exp.run()
  })

// 从校对好的 CSV 写回语言包
cli
  .command('import [file]', 'Import translations from a CSV back into locale files')
  .option('--fill-only', 'only fill blank translations (default: overwrite all)')
  .option('-c, --config <file>', 'use specified config file')
  .option('--logger <level>', 'Log level: none | error | warn | info')
  .action(async (file: string | undefined, options: any) => {
    // 用 [file] 可选参数 + 自校验,避免 cac 对缺失必填参数抛出未捕获异常
    if (!file) {
      const { logger } = await import('../utils/logger')
      logger.error(
        '请提供要导入的 CSV 文件路径,例如:npx i18n import ./src/locale/i18n.csv',
      )
      return
    }
    const { Import } = await import('../commands/Import')
    const imp = new Import(file, options)
    imp.run()
  })

cli.parse()
