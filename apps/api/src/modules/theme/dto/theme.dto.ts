import { IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateThemeDto {
  @ApiProperty({
    description: 'JSON object containing theme configuration (colors, font sizes, etc.)',
    example: {
      primaryColor: '#3b82f6',
      sidebarColor: '#1e293b',
      borderRadius: '8px',
      darkMode: false,
    },
  })
  @IsNotEmpty()
  @IsObject()
  themeConfig: any;
}
