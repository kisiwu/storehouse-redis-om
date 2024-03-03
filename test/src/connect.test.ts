import { Debug } from '@novice1/logger';
import Storehouse from '@storehouse/core';
import { EntityId, Schema } from 'redis-om'
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
            // RedisClientOptions
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
      logger.info('events=', conn.eventNames());

      const manager = getManager(Storehouse);
      await manager.dropIndexes() // force dropping indexes
      await manager.createIndexes()
      logger.info('created indexes for all repositories (to use RedisSearch)');

      const AlbumsModel = manager.getModel('album');
      if (AlbumsModel) {
        logger.log('nb albums:', await AlbumsModel.search().return.count());
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
      if (r?.[EntityId])
        Albums?.expire(r[EntityId], 120 * 1000)
      logger.info('added new album from', r?.artist, `ID=${r?.[EntityId]}`);
      logger.log('current nb albums:', await Albums?.search().return.count());

      const fetchedAlbum = await Albums?.fetch('test');
      if (fetchedAlbum) {
        logger.log('found album title:', fetchedAlbum.title);
      }

      logger.info('deleted album', await Albums?.remove('test'));

      logger.log('current nb albums:', await Albums?.search().return.count());

      await Storehouse.close();
    } catch (e) {
      await Storehouse.close();
      logger.info('closed connections');
      throw e;
    }
  });
});
