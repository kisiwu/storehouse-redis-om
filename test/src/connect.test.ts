import { Debug } from '@novice1/logger';
import Storehouse from '@storehouse/core';
import { Schema } from 'redis-om'
import { RedisOMManager, getModel, getManager, getConnection } from '../../src/index';

Debug.enable('@storehouse/redis-om*');

describe('connect', function () {
  const { logger, params } = this.ctx.kaukau;

  it('should init and connect', async () => {
    try {
      const albumSchema = new Schema('album', {
        artist: { type: 'string' },
        title: { type: 'text' },
        year: { type: 'number' },
        genres: { type: 'string[]' },
        songDurations: { type: 'number[]' },
        outOfPublication: { type: 'boolean' }
      })
      const studioSchema = new Schema('studio', {
        name: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        location: { type: 'point' },
        established: { type: 'date' }
      })

      Storehouse.add({
        redisom: {
          type: RedisOMManager,
          config: {
            models: [albumSchema, studioSchema],
            // MongoClientOptions
            options: {
              password: params('redis.password'),
              socket: {
                host: params('redis.host'),
                port: params('redis.port')
              }
            }
          }
        }
      });

      const conn = getConnection(Storehouse, 'redisom')
      await conn.connect();
      logger.info('retrieved connection');
      logger.info(conn.eventNames());

      const manager = getManager(Storehouse);
      const AlbumsModel = manager.getModel('album');
      if (AlbumsModel) {
        logger.log('album test:', await AlbumsModel.fetch('test'));
      }

      const Albums = getModel(Storehouse, 'album');

      const album = {
        artist: 'Mushroomhead',
        title: 'The Righteous & The Butterfly',
        year: 2014,
        genres: ['metal'],
        songDurations: [204, 290, 196, 210, 211, 105, 244, 245, 209, 252, 259, 200, 215, 219],
        outOfPublication: true
      }
      const r = await Albums?.save('test', album)
      logger.info('added new album from', r?.artist);

      const fetchedAlbum = await Albums?.fetch('test');
      if (fetchedAlbum) {
        logger.log('new album title:', fetchedAlbum.title);
      }

      logger.info('deleted album', await Albums?.remove('test'));

      logger.log('current album "test":', await Albums?.fetch('test'));

      await Storehouse.close();
    } catch (e) {
      await Storehouse.close();
      logger.info('closed connections');
      throw e;
    }
  });
});
