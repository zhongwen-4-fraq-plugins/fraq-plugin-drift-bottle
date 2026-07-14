import type { Context, Session } from '@fraqjs/fraq';

export function registerHelpCommand(ctx: Context): void {
  async function showHelp(session: Session): Promise<void> {
    await session.reply(
      [
        '漂流瓶命令：',
        '扔瓶子 <内容> - 投递一个漂流瓶',
        '捡瓶子 - 随机捡取一个漂流瓶',
        '评论漂流瓶 <ID> <内容> - 评论指定漂流瓶，省略内容可查看评论',
        '漂流瓶重复捡 开启/关闭/默认 - 设置个人捡取行为',
        '漂流瓶署名 匿名 - 使用匿名署名',
        '漂流瓶署名 原名 - 使用群昵称或 QQ 昵称',
        '漂流瓶署名 <别名> - 使用指定别名',
        '删除漂流瓶 <ID> - 删除自己的漂流瓶，管理人员可删除任意瓶子',
        '漂流瓶权限 添加/删除 <QQ号或@用户...> - 管理删除权限（仅主人）',
        '漂流瓶权限 列表 - 查看删除权限（仅主人）',
        '漂流瓶帮助 - 查看本帮助',
        '',
        '支持文字、图片、视频、表情、动态表情和合并转发。',
        '回复包含非文字内容的消息后发送“扔瓶子”也可以投递。',
      ].join('\n'),
    );
  }

  ctx.router.command('漂流瓶帮助').alias('漂流瓶help').describe('查看漂流瓶命令帮助').execute(showHelp);
  ctx.router.group('漂流瓶').command('help').describe('查看漂流瓶命令帮助').execute(showHelp);
}
