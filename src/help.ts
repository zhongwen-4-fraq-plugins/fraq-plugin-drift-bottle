import type { Context, Session } from '@fraqjs/fraq';

export function registerHelpCommand(ctx: Context): void {
  async function showHelp(session: Session): Promise<void> {
    const commands = [
      ['扔瓶子 <内容>', '投递漂流瓶；支持文字、图片、视频、表情、动态表情和合并转发，也可以回复消息投递。'],
      ['捡瓶子', '随机捡取一个漂流瓶。'],
      ['评论漂流瓶 <ID> [内容]', '评论或查看指定漂流瓶；也可以回复带 ID 的漂流瓶消息操作。'],
      ['漂流瓶重复捡 开启', '个人捡取后保留瓶子。'],
      ['漂流瓶重复捡 关闭', '个人捡取后删除瓶子。'],
      ['漂流瓶重复捡 默认', '清除个人设置，恢复捡取后删除。'],
      ['漂流瓶署名 匿名', '后续投递使用匿名署名。'],
      ['漂流瓶署名 原名', '后续投递使用群昵称或 QQ 昵称。'],
      ['漂流瓶署名 <别名>', '后续投递使用指定别名。'],
      ['删除漂流瓶 <ID>', '删除自己的漂流瓶；管理人员可删除任意瓶子。'],
      ['漂流瓶权限 添加 <QQ号或@用户...>', '添加一个或多个删除权限用户，仅插件主人可用。'],
      ['漂流瓶权限 删除 <QQ号或@用户...>', '移除一个或多个删除权限用户，仅插件主人可用。'],
      ['漂流瓶权限 列表', '查看删除权限列表，仅插件主人可用。'],
      ['漂流瓶帮助', '查看本帮助；也支持“漂流瓶help”和“漂流瓶 help”。'],
    ];
    const time = Math.floor(Date.now() / 1000);
    await session.reply([
      {
        type: 'forward',
        data: {
          messages: commands.map(([command, description]) => ({
            user_id: session.selfId,
            sender_name: '漂流瓶帮助',
            time,
            segments: [{ type: 'text', data: { text: `${command}\n${description}` } }],
          })),
          title: '漂流瓶命令帮助',
          preview: commands.slice(0, 4).map(([command]) => command),
          summary: `共 ${commands.length} 条命令`,
        },
      },
    ]);
  }

  ctx.router.command('漂流瓶帮助').alias('漂流瓶help').describe('查看漂流瓶命令帮助').execute(showHelp);
  ctx.router.group('漂流瓶').command('help').describe('查看漂流瓶命令帮助').execute(showHelp);
}
