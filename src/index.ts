import { createColoredLogHandler } from '@fraqjs/color-log';
import { Context, param } from '@fraqjs/fraq';

const ctx = Context.fromUrl('http://127.0.0.1:30001/', {
  logHandler: createColoredLogHandler({
    minLevel: 'debug',
  }),
});

ctx.router
  .command('echo')
  .arg('content', param.str())
  .execute((session, { content }) => {
    session.reply(`You said: ${content}`);
  });

ctx.start();
