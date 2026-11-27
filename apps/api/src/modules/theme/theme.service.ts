import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateThemeDto } from './dto/theme.dto';

@Injectable()
export class ThemeService {
  constructor(private readonly prisma: PrismaService) {}

  async getThemePreference(userId: string) {
    const preference = await this.prisma.userThemePreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      // Return default theme if no preference exists
      return {
        userId,
        themeConfig: {
          primaryColor: '#3b82f6',
          secondaryColor: '#10b981',
          accentColor: '#f59e0b',
          sidebarColor: '#1e293b',
          borderRadius: '6px',
          darkMode: false,
          fontFamily: 'Inter, sans-serif',
        },
      };
    }

    return preference;
  }

  async updateThemePreference(userId: string, dto: UpdateThemeDto) {
    return this.prisma.userThemePreference.upsert({
      where: { userId },
      update: {
        themeConfig: dto.themeConfig,
      },
      create: {
        userId,
        themeConfig: dto.themeConfig,
      },
    });
  }
}
