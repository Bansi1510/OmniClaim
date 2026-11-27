import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThemeService } from './theme.service';
import { UpdateThemeDto } from './dto/theme.dto';
import { DynamicPermissionsGuard } from '../../common/guards/dynamic-permissions.guard';

@ApiTags('Theme & Appearance')
@ApiBearerAuth()
@Controller('api/v1/theme')
@UseGuards(DynamicPermissionsGuard)
export class ThemeController {
  constructor(private readonly themeService: ThemeService) {}

  @Get('preference')
  @ApiOperation({ summary: 'Get current user theme preferences' })
  async getTheme(@CurrentUser() user: AuthenticatedUser) {
    return this.themeService.getThemePreference(user.id);
  }

  @Put('preference')
  @ApiOperation({ summary: 'Update current user theme preferences' })
  async updateTheme(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateThemeDto,
  ) {
    return this.themeService.updateThemePreference(user.id, dto);
  }
}
