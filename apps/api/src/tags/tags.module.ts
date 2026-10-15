import { Module } from '@nestjs/common';
import { ApplicationTagsController, TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';

@Module({
  controllers: [TagsController, ApplicationTagsController],
  providers: [TagsService],
})
export class TagsModule {}
