import type { Context, Session } from '@fraqjs/fraq';

export function registerHelpCommand(ctx: Context): void {
  async function showHelp(session: Session): Promise<void> {
    await session.reply(
      [
        '漂流瓶命令：',
        '扔漂流瓶 <内容> - 投递一个漂流瓶',
        '捡漂流瓶 - 随机捡取一个漂流瓶',
        '漂流瓶署名 匿名 - 使用匿名署名',
        '漂流瓶署名 <别名> - 使用指定别名',
        '漂流瓶帮助 - 查看本帮助',
        '',
        '支持文字、图片、视频、表情、动态表情和合并转发。',
        '回复包含非文字内容的消息后发送“扔漂流瓶”也可以投递。',
      ].join('\n'),
    );
  }

  ctx.router.command('漂流瓶帮助').alias('漂流瓶help').describe('查看漂流瓶命令帮助').execute(showHelp);
  ctx.router.group('漂流瓶').command('help').describe('查看漂流瓶命令帮助').execute(showHelp);
}
