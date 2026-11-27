import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  PolicyApplicationStatus,
  QuoteStatus,
  UnderwritingDecision,
  PolicyPaymentStatus,
  PolicyLifecycleStatus,
} from '@omniclaim/database';
import { PremiumEngineService } from './premium-engine.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  UploadApplicationDocDto,
  UnderwritingDecisionDto,
  PayAndIssueDto,
  CreateEndorsementDto,
  CancelPolicyDto,
  UpsertProductDto,
  UpsertCategoryDto,
  UpsertVehicleTypeDto,
} from './dto/policy-application.dto';

export interface PolicyActorContext {
  id: string;
  roles?: string[];
  permissions?: string[];
  isSuperAdmin?: boolean;
  isMasterLogin?: boolean;
  bypassAllPermissions?: boolean;
}

@Injectable()
export class PolicyApplicationsService {
  private readonly logger = new Logger(PolicyApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly premiumEngine: PremiumEngineService,
  ) {}

  private isElevated(user?: PolicyActorContext): boolean {
    if (!user) return false;
    if (
      user.isSuperAdmin ||
      user.isMasterLogin ||
      user.bypassAllPermissions ||
      user.roles?.includes('SUPER_ADMIN') ||
      user.permissions?.includes('*')
    ) {
      return true;
    }
    const staffPerms = [
      'underwriting:review',
      'underwriting:approve',
      'policies:manage',
      'products:manage',
      'superadmin:access',
    ];
    return staffPerms.some((p) => user.permissions?.includes(p));
  }

  private assertOwnershipOrStaff(ownerUserId: string, actor?: PolicyActorContext) {
    if (!actor?.id) {
      throw new ForbiddenException('Authenticated user context required.');
    }
    if (!this.isElevated(actor) && ownerUserId !== actor.id) {
      throw new ForbiddenException('Access denied: record belongs to another policyholder.');
    }
  }

  // ==========================================
  // 1. POLICY CATEGORY & PRODUCT CATALOG
  // ==========================================

  async listCategories() {
    return this.prisma.policyCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        vehicleTypes: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        products: {
          where: { isActive: true },
          include: { vehicleType: true },
          orderBy: { baseRateAnnual: 'asc' },
        },
      },
    });
  }

  async listVehicleTypes(categoryCode?: string) {
    return this.prisma.vehicleType.findMany({
      where: {
        isActive: true,
        ...(categoryCode ? { category: { code: categoryCode } } : {}),
      },
      include: {
        category: true,
        _count: { select: { products: true } },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  async upsertVehicleType(dto: UpsertVehicleTypeDto) {
    const category = await this.prisma.policyCategory.findUnique({
      where: { code: dto.categoryCode.trim().toUpperCase() },
    });
    if (!category) {
      throw new NotFoundException(`PolicyCategory ${dto.categoryCode} not found.`);
    }

    const cleanCode = dto.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    if (dto.id) {
      const existing = await this.prisma.vehicleType.findUnique({ where: { id: dto.id } });
      if (!existing) throw new NotFoundException(`VehicleType ${dto.id} not found.`);
      return this.prisma.vehicleType.update({
        where: { id: dto.id },
        data: {
          categoryId: category.id,
          code: cleanCode,
          name: dto.name.trim(),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: { category: true, _count: { select: { products: true } } },
      });
    }

    return this.prisma.vehicleType.upsert({
      where: { categoryId_code: { categoryId: category.id, code: cleanCode } },
      update: {
        name: dto.name.trim(),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      create: {
        categoryId: category.id,
        code: cleanCode,
        name: dto.name.trim(),
        description: dto.description,
        icon: dto.icon || 'Car',
        sortOrder: dto.sortOrder ?? 10,
        isActive: dto.isActive ?? true,
      },
      include: { category: true, _count: { select: { products: true } } },
    });
  }

  async deleteVehicleType(id: string) {
    const existing = await this.prisma.vehicleType.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) throw new NotFoundException(`VehicleType ${id} not found.`);

    if (existing._count.products > 0) {
      return this.prisma.vehicleType.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.vehicleType.delete({ where: { id } });
  }

  async listProducts(categoryCode?: string, vehicleTypeId?: string) {
    return this.prisma.policyProduct.findMany({
      where: {
        isActive: true,
        ...(categoryCode ? { category: { code: categoryCode } } : {}),
        ...(vehicleTypeId ? { vehicleTypeId } : {}),
      },
      include: { category: true, vehicleType: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { baseRateAnnual: 'asc' }],
    });
  }

  async upsertCategory(dto: UpsertCategoryDto) {
    const cleanCode = dto.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (dto.id) {
      const existing = await this.prisma.policyCategory.findUnique({ where: { id: dto.id } });
      if (!existing) throw new NotFoundException(`PolicyCategory ${dto.id} not found.`);
      return this.prisma.policyCategory.update({
        where: { id: dto.id },
        data: {
          code: cleanCode,
          name: dto.name,
          description: dto.description,
          ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
          ...(dto.requiresUnderwriting !== undefined ? { requiresUnderwriting: dto.requiresUnderwriting } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: { products: true },
      });
    }

    return this.prisma.policyCategory.upsert({
      where: { code: cleanCode },
      update: {
        name: dto.name,
        description: dto.description,
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.requiresUnderwriting !== undefined ? { requiresUnderwriting: dto.requiresUnderwriting } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      create: {
        code: cleanCode,
        name: dto.name,
        description: dto.description,
        icon: dto.icon || 'Shield',
        requiresUnderwriting: dto.requiresUnderwriting ?? true,
        sortOrder: dto.sortOrder ?? 10,
        isActive: dto.isActive ?? true,
      },
      include: { products: true },
    });
  }

  async deleteCategory(id: string) {
    const existing = await this.prisma.policyCategory.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) throw new NotFoundException(`PolicyCategory ${id} not found.`);

    if (existing._count.products > 0) {
      return this.prisma.policyCategory.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.policyCategory.delete({ where: { id } });
  }

  async deleteProduct(id: string) {
    const existing = await this.prisma.policyProduct.findUnique({
      where: { id },
      include: { _count: { select: { applications: true, policies: true } } },
    });
    if (!existing) throw new NotFoundException(`PolicyProduct ${id} not found.`);

    if (existing._count.applications > 0 || existing._count.policies > 0) {
      return this.prisma.policyProduct.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.policyProduct.delete({ where: { id } });
  }

  async upsertProduct(dto: UpsertProductDto) {
    const category = await this.prisma.policyCategory.findUnique({
      where: { code: dto.categoryCode },
    });
    if (!category) {
      throw new NotFoundException(`PolicyCategory ${dto.categoryCode} not found.`);
    }

    if (dto.vehicleTypeId) {
      const vt = await this.prisma.vehicleType.findUnique({ where: { id: dto.vehicleTypeId } });
      if (!vt) {
        throw new NotFoundException(`VehicleType ${dto.vehicleTypeId} not found.`);
      }
      if (vt.categoryId !== category.id) {
        throw new BadRequestException(
          `VehicleType "${vt.name}" does not belong to category "${category.name}".`,
        );
      }
    }

    if (dto.id) {
      const existing = await this.prisma.policyProduct.findUnique({ where: { id: dto.id } });
      if (!existing) throw new NotFoundException(`Product ${dto.id} not found.`);
      return this.prisma.policyProduct.update({
        where: { id: dto.id },
        data: {
          name: dto.name,
          description: dto.description,
          categoryId: category.id,
          ...(dto.vehicleTypeId !== undefined ? { vehicleTypeId: dto.vehicleTypeId || null } : {}),
          baseRateAnnual: dto.baseRateAnnual,
          minCoverageAmount: dto.minCoverageAmount,
          maxCoverageAmount: dto.maxCoverageAmount,
          defaultDeductible: dto.defaultDeductible,
          ...(dto.termMonthsOptions ? { termMonthsOptions: dto.termMonthsOptions } : {}),
          ...(dto.requiredDocumentsJson ? { requiredDocumentsJson: dto.requiredDocumentsJson } : {}),
          ...(dto.eligibilityJson !== undefined ? { eligibilityJson: dto.eligibilityJson } : {}),
          ...(dto.exclusionsJson !== undefined ? { exclusionsJson: dto.exclusionsJson } : {}),
          ...(dto.addonsJson !== undefined ? { addonsJson: dto.addonsJson } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          version: { increment: 1 },
        },
        include: { category: true, vehicleType: true },
      });
    }

    return this.prisma.policyProduct.upsert({
      where: { productCode: dto.productCode },
      update: {
        name: dto.name,
        description: dto.description,
        categoryId: category.id,
        ...(dto.vehicleTypeId !== undefined ? { vehicleTypeId: dto.vehicleTypeId || null } : {}),
        baseRateAnnual: dto.baseRateAnnual,
        minCoverageAmount: dto.minCoverageAmount,
        maxCoverageAmount: dto.maxCoverageAmount,
        defaultDeductible: dto.defaultDeductible,
        ...(dto.termMonthsOptions ? { termMonthsOptions: dto.termMonthsOptions } : {}),
        ...(dto.requiredDocumentsJson ? { requiredDocumentsJson: dto.requiredDocumentsJson } : {}),
        ...(dto.eligibilityJson !== undefined ? { eligibilityJson: dto.eligibilityJson } : {}),
        ...(dto.exclusionsJson !== undefined ? { exclusionsJson: dto.exclusionsJson } : {}),
        ...(dto.addonsJson !== undefined ? { addonsJson: dto.addonsJson } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        version: { increment: 1 },
      },
      create: {
        productCode: dto.productCode,
        categoryId: category.id,
        vehicleTypeId: dto.vehicleTypeId || null,
        name: dto.name,
        description: dto.description,
        baseRateAnnual: dto.baseRateAnnual,
        minCoverageAmount: dto.minCoverageAmount,
        maxCoverageAmount: dto.maxCoverageAmount,
        defaultDeductible: dto.defaultDeductible,
        termMonthsOptions: dto.termMonthsOptions || [6, 12, 24],
        requiredDocumentsJson: dto.requiredDocumentsJson || ['ID_PROOF'],
        eligibilityJson: dto.eligibilityJson ?? Prisma.JsonNull,
        exclusionsJson: dto.exclusionsJson ?? Prisma.JsonNull,
        addonsJson: dto.addonsJson ?? Prisma.JsonNull,
        isActive: dto.isActive ?? true,
      },
      include: { category: true, vehicleType: true },
    });
  }

  // ==========================================
  // 2. POLICY APPLICATION WORKFLOW
  // ==========================================

  private generateCode(prefix: string): string {
    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const rnd = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${ym}-${rnd}`;
  }

  async createDraft(dto: CreateApplicationDto, userId: string) {
    const product = await this.prisma.policyProduct.findUnique({
      where: { id: dto.productId },
      include: { category: true },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException(`Active PolicyProduct ${dto.productId} not found.`);
    }

    if (
      dto.requestedCoverage < Number(product.minCoverageAmount) ||
      dto.requestedCoverage > Number(product.maxCoverageAmount)
    ) {
      throw new BadRequestException(
        `Requested coverage must be between ${product.minCoverageAmount} and ${product.maxCoverageAmount} for ${product.name}.`,
      );
    }

    if (
      dto.vehicleTypeId &&
      product.vehicleTypeId &&
      dto.vehicleTypeId !== product.vehicleTypeId
    ) {
      throw new BadRequestException(
        `Selected product "${product.name}" is not eligible for the chosen vehicle type.`,
      );
    }

    return this.prisma.policyApplication.create({
      data: {
        applicationNumber: this.generateCode('APP'),
        applicantUserId: userId,
        productId: product.id,
        vehicleTypeId: dto.vehicleTypeId || product.vehicleTypeId || null,
        productVersionSnapshot: product.version,
        status: PolicyApplicationStatus.DRAFT,
        requestedCoverage: dto.requestedCoverage,
        requestedDeductible: dto.requestedDeductible,
        termMonths: dto.termMonths,
        desiredStartDate: dto.desiredStartDate ? new Date(dto.desiredStartDate) : new Date(),
        applicantDetailsJson: dto.applicantDetailsJson,
        riskDetailsJson: dto.riskDetailsJson,
        nomineeDetailsJson: dto.nomineeDetailsJson,
      },
      include: {
        product: { include: { category: true } },
        documents: true,
        quotes: true,
      },
    });
  }

  async listApplications(actor: PolicyActorContext, status?: PolicyApplicationStatus) {
    const isStaff = this.isElevated(actor);
    return this.prisma.policyApplication.findMany({
      where: {
        ...(!isStaff ? { applicantUserId: actor.id } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        applicant: { select: { id: true, fullName: true, email: true, username: true } },
        product: { include: { category: true } },
        documents: true,
        quotes: { orderBy: { createdAt: 'desc' } },
        underwritingReviews: {
          include: { reviewer: { select: { id: true, fullName: true } } },
          orderBy: { reviewedAt: 'desc' },
        },
        payments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getApplication(id: string, actor: PolicyActorContext) {
    const app = await this.prisma.policyApplication.findUnique({
      where: { id },
      include: {
        applicant: { select: { id: true, fullName: true, email: true, username: true } },
        product: { include: { category: true } },
        documents: { orderBy: { createdAt: 'desc' } },
        quotes: { orderBy: { createdAt: 'desc' } },
        underwritingReviews: {
          include: { reviewer: { select: { id: true, fullName: true } } },
          orderBy: { reviewedAt: 'desc' },
        },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!app) {
      throw new NotFoundException(`PolicyApplication ${id} not found.`);
    }
    this.assertOwnershipOrStaff(app.applicantUserId, actor);
    return app;
  }

  async updateDraft(id: string, dto: UpdateApplicationDto, actor: PolicyActorContext) {
    const app = await this.getApplication(id, actor);
    if (
      app.status !== PolicyApplicationStatus.DRAFT &&
      app.status !== PolicyApplicationStatus.DOCS_REQUIRED
    ) {
      throw new BadRequestException(
        `Cannot edit application in status ${app.status}. Only DRAFT or DOCS_REQUIRED applications are editable.`,
      );
    }

    if (dto.requestedCoverage !== undefined) {
      if (
        dto.requestedCoverage < Number(app.product.minCoverageAmount) ||
        dto.requestedCoverage > Number(app.product.maxCoverageAmount)
      ) {
        throw new BadRequestException(
          `Coverage must be between ${app.product.minCoverageAmount} and ${app.product.maxCoverageAmount}.`,
        );
      }
    }

    return this.prisma.policyApplication.update({
      where: { id },
      data: {
        ...(dto.requestedCoverage !== undefined ? { requestedCoverage: dto.requestedCoverage } : {}),
        ...(dto.requestedDeductible !== undefined ? { requestedDeductible: dto.requestedDeductible } : {}),
        ...(dto.termMonths !== undefined ? { termMonths: dto.termMonths } : {}),
        ...(dto.desiredStartDate ? { desiredStartDate: new Date(dto.desiredStartDate) } : {}),
        ...(dto.applicantDetailsJson ? { applicantDetailsJson: dto.applicantDetailsJson } : {}),
        ...(dto.riskDetailsJson ? { riskDetailsJson: dto.riskDetailsJson } : {}),
        ...(dto.nomineeDetailsJson ? { nomineeDetailsJson: dto.nomineeDetailsJson } : {}),
        version: { increment: 1 },
      },
      include: {
        product: { include: { category: true } },
        documents: true,
        quotes: true,
      },
    });
  }

  async uploadDocument(id: string, dto: UploadApplicationDocDto, actor: PolicyActorContext) {
    const app = await this.getApplication(id, actor);
    const existingSameType = await this.prisma.policyApplicationDocument.count({
      where: { applicationId: app.id, docType: dto.docType },
    });

    return this.prisma.policyApplicationDocument.create({
      data: {
        applicationId: app.id,
        docType: dto.docType,
        fileName: dto.fileName,
        mimeType: dto.mimeType || 'application/pdf',
        fileSizeBytes: dto.fileSizeBytes || 0,
        fileUrl: dto.fileUrl,
        version: existingSameType + 1,
        uploadedById: actor.id,
      },
    });
  }

  private async createQuoteRecord(
    tx: Prisma.TransactionClient,
    app: any,
    underwriterLoading: number = 0,
  ) {
    const calc = this.premiumEngine.calculateQuote({
      baseRateAnnual: app.product.baseRateAnnual,
      defaultDeductible: app.product.defaultDeductible,
      requestedCoverage: app.requestedCoverage,
      requestedDeductible: app.requestedDeductible,
      termMonths: app.termMonths,
      categoryCode: app.product.category.code,
      riskDetailsJson: (app.riskDetailsJson as Record<string, any>) || {},
      underwriterLoading,
    });

    const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return tx.insuranceQuote.create({
      data: {
        quoteNumber: this.generateCode('QT'),
        applicationId: app.id,
        status: QuoteStatus.GENERATED,
        basePremium: calc.basePremium,
        riskLoading: calc.riskLoading,
        discountAmount: calc.discountAmount,
        taxAmount: calc.taxAmount,
        totalPremium: calc.totalPremium,
        coverageAmount: app.requestedCoverage,
        deductible: app.requestedDeductible,
        termMonths: app.termMonths,
        calculationBreakdownJson: calc.calculationBreakdownJson,
        validUntil,
      },
    });
  }

  async submitApplication(id: string, actor: PolicyActorContext) {
    const app = await this.getApplication(id, actor);
    if (
      app.status !== PolicyApplicationStatus.DRAFT &&
      app.status !== PolicyApplicationStatus.DOCS_REQUIRED
    ) {
      throw new BadRequestException(`Application ${app.applicationNumber} cannot be submitted from status ${app.status}.`);
    }

    const rules = (app.product.underwritingRulesJson as Record<string, any>) || {};
    const instantEligible =
      !app.product.category.requiresUnderwriting ||
      Boolean(rules.instantQuoteEligible) ||
      (rules.autoApproveMaxCoverage !== undefined &&
        Number(app.requestedCoverage) <= Number(rules.autoApproveMaxCoverage));

    return this.prisma.$transaction(async (tx) => {
      if (instantEligible) {
        const quote = await this.createQuoteRecord(tx, app, 0);
        const updated = await tx.policyApplication.update({
          where: { id: app.id },
          data: {
            status: PolicyApplicationStatus.QUOTED,
            submittedAt: app.submittedAt || new Date(),
            version: { increment: 1 },
          },
          include: {
            product: { include: { category: true } },
            documents: true,
            quotes: { orderBy: { createdAt: 'desc' } },
          },
        });
        return { application: updated, quote, autoQuoted: true };
      }

      const updated = await tx.policyApplication.update({
        where: { id: app.id },
        data: {
          status: PolicyApplicationStatus.SUBMITTED,
          submittedAt: app.submittedAt || new Date(),
          version: { increment: 1 },
        },
        include: {
          product: { include: { category: true } },
          documents: true,
          quotes: { orderBy: { createdAt: 'desc' } },
        },
      });
      return { application: updated, autoQuoted: false };
    });
  }

  async generateQuote(id: string, actor: PolicyActorContext) {
    const app = await this.getApplication(id, actor);
    return this.prisma.$transaction(async (tx) => {
      const quote = await this.createQuoteRecord(tx, app, 0);
      await tx.policyApplication.update({
        where: { id: app.id },
        data: { status: PolicyApplicationStatus.QUOTED, version: { increment: 1 } },
      });
      return quote;
    });
  }

  async acceptQuote(applicationId: string, quoteId: string, actor: PolicyActorContext) {
    const app = await this.getApplication(applicationId, actor);
    const quote = app.quotes.find((q) => q.id === quoteId);
    if (!quote) throw new NotFoundException(`Quote ${quoteId} not found for application.`);
    if (quote.status === QuoteStatus.EXPIRED || quote.validUntil < new Date()) {
      throw new BadRequestException('Quote has expired. Please generate a fresh quote.');
    }

    return this.prisma.$transaction(async (tx) => {
      const acceptedQuote = await tx.insuranceQuote.update({
        where: { id: quoteId },
        data: { status: QuoteStatus.ACCEPTED, acceptedAt: new Date() },
      });
      const updatedApp = await tx.policyApplication.update({
        where: { id: applicationId },
        data: { status: PolicyApplicationStatus.QUOTE_ACCEPTED, version: { increment: 1 } },
      });
      return { quote: acceptedQuote, application: updatedApp };
    });
  }

  async rejectQuote(applicationId: string, quoteId: string, actor: PolicyActorContext) {
    const app = await this.getApplication(applicationId, actor);
    const quote = app.quotes.find((q) => q.id === quoteId);
    if (!quote) throw new NotFoundException(`Quote ${quoteId} not found for application.`);

    return this.prisma.insuranceQuote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.REJECTED },
    });
  }

  // ==========================================
  // 3. UNDERWRITING DECISION WORKFLOW
  // ==========================================

  async submitUnderwritingDecision(
    applicationId: string,
    dto: UnderwritingDecisionDto,
    reviewerId: string,
  ) {
    const app = await this.prisma.policyApplication.findUnique({
      where: { id: applicationId },
      include: {
        product: { include: { category: true } },
      },
    });
    if (!app) {
      throw new NotFoundException(`PolicyApplication ${applicationId} not found.`);
    }

    const allowedReviewStatuses: PolicyApplicationStatus[] = [
      PolicyApplicationStatus.SUBMITTED,
      PolicyApplicationStatus.UNDER_REVIEW,
      PolicyApplicationStatus.DOCS_REQUIRED,
    ];
    if (!allowedReviewStatuses.includes(app.status)) {
      throw new BadRequestException(`Application ${app.applicationNumber} in status ${app.status} is not awaiting underwriting.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.underwritingReview.create({
        data: {
          applicationId: app.id,
          reviewerId,
          decision: dto.decision as UnderwritingDecision,
          riskScore: dto.riskScore,
          premiumLoading: dto.premiumLoading ?? 0,
          notes: dto.notes,
        },
      });

      if (dto.decision === 'APPROVED') {
        const quote = await this.createQuoteRecord(tx, app, dto.premiumLoading ?? 0);
        const updatedApp = await tx.policyApplication.update({
          where: { id: app.id },
          data: { status: PolicyApplicationStatus.QUOTED, version: { increment: 1 } },
        });
        return { review, application: updatedApp, quote };
      }

      const nextStatus =
        dto.decision === 'DECLINED'
          ? PolicyApplicationStatus.REJECTED
          : PolicyApplicationStatus.DOCS_REQUIRED;

      const updatedApp = await tx.policyApplication.update({
        where: { id: app.id },
        data: { status: nextStatus, version: { increment: 1 } },
      });

      return { review, application: updatedApp };
    });
  }

  // ==========================================
  // 4. IDEMPOTENT PAYMENT & POLICY ISSUANCE
  // ==========================================

  async payAndIssuePolicy(applicationId: string, dto: PayAndIssueDto, actor: PolicyActorContext) {
    const app = await this.getApplication(applicationId, actor);
    const effectiveKey = dto.idempotencyKey || `POLPAY-${applicationId}`;

    if (
      app.status === PolicyApplicationStatus.REJECTED ||
      app.status === PolicyApplicationStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot accept payment for ${app.status} application.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Idempotency Replay Guard
      const existingPayment =
        (await tx.policyPayment.findUnique({ where: { idempotencyKey: effectiveKey } })) ||
        (await tx.policyPayment.findFirst({
          where: { applicationId, status: PolicyPaymentStatus.SUCCEEDED },
        }));

      if (existingPayment) {
        const issuedPolicy = app.issuedPolicyId
          ? await tx.policy.findUnique({ where: { id: app.issuedPolicyId } })
          : await tx.policy.findUnique({ where: { applicationId } });

        this.logger.warn(`Idempotent PolicyPayment replay for application ${applicationId} (key=${effectiveKey})`);
        return {
          idempotentReplay: true,
          payment: existingPayment,
          policy: issuedPolicy,
          application: app,
        };
      }

      // Resolve target quote (explicit or accepted or latest generated)
      const targetQuote = dto.quoteId
        ? app.quotes.find((q) => q.id === dto.quoteId)
        : app.quotes.find((q) => q.status === QuoteStatus.ACCEPTED) ||
          app.quotes.find((q) => q.status === QuoteStatus.GENERATED);

      if (!targetQuote) {
        throw new BadRequestException('A valid InsuranceQuote is required before payment and issuance.');
      }

      const payment = await tx.policyPayment.create({
        data: {
          idempotencyKey: effectiveKey,
          applicationId: app.id,
          quoteId: targetQuote.id,
          amount: targetQuote.totalPremium,
          paymentMethod: dto.paymentMethod,
          status: PolicyPaymentStatus.SUCCEEDED,
          gatewayReference: `POLGW-${Date.now()}`,
          paidById: actor.id,
          paidAt: new Date(),
        },
      });

      if (targetQuote.status === QuoteStatus.GENERATED) {
        await tx.insuranceQuote.update({
          where: { id: targetQuote.id },
          data: { status: QuoteStatus.ACCEPTED, acceptedAt: new Date() },
        });
      }

      const startDate = app.desiredStartDate || new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + targetQuote.termMonths);

      const risk = (app.riskDetailsJson as Record<string, any>) || {};
      const catCode = app.product.category.code;

      const policyNumber = this.generateCode(`POL-${catCode}`);
      const policy = await tx.policy.create({
        data: {
          policyNumber,
          policyHolderId: app.applicantUserId,
          productId: app.productId,
          vehicleTypeId: app.vehicleTypeId || app.product.vehicleTypeId || null,
          applicationId: app.id,
          categoryCode: catCode,
          annualPremium: targetQuote.totalPremium,
          lifecycleStatus: PolicyLifecycleStatus.ACTIVE,
          vehicleVin: String(risk.vehicleVin || `${catCode}-${app.applicationNumber}`),
          vehicleMake: String(risk.vehicleMake || app.product.name),
          vehicleModel: String(risk.vehicleModel || risk.planTier || catCode),
          vehicleYear: Number(risk.vehicleYear || new Date().getFullYear()),
          coverageLimit: targetQuote.coverageAmount,
          baseDeductible: targetQuote.deductible,
          startDate,
          endDate,
          isActive: true,
        },
      });

      const updatedApp = await tx.policyApplication.update({
        where: { id: app.id },
        data: {
          status: PolicyApplicationStatus.ISSUED,
          issuedPolicyId: policy.id,
          version: { increment: 1 },
        },
      });

      return {
        idempotentReplay: false,
        payment,
        policy,
        application: updatedApp,
      };
    });
  }

  // ==========================================
  // 5. POLICY PORTFOLIO, ENDORSEMENT, RENEWAL & CANCELLATION
  // ==========================================

  async listPolicies(actor: PolicyActorContext) {
    const isStaff = this.isElevated(actor);
    return this.prisma.policy.findMany({
      where: !isStaff ? { policyHolderId: actor.id } : undefined,
      include: {
        product: { include: { category: true } },
        endorsements: { orderBy: { createdAt: 'desc' } },
        renewals: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEndorsement(policyId: string, dto: CreateEndorsementDto, actor: PolicyActorContext) {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) throw new NotFoundException(`Policy ${policyId} not found.`);
    this.assertOwnershipOrStaff(policy.policyHolderId, actor);

    return this.prisma.$transaction(async (tx) => {
      const endorsement = await tx.policyEndorsement.create({
        data: {
          policyId,
          endorsementType: dto.endorsementType,
          description: dto.description,
          premiumDelta: dto.premiumDelta ?? 0,
          changesJson: {
            ...(dto.changesJson || {}),
            ...(dto.newCoverageLimit !== undefined ? { newCoverageLimit: dto.newCoverageLimit } : {}),
            ...(dto.newDeductible !== undefined ? { newDeductible: dto.newDeductible } : {}),
          },
          approvedById: actor.id,
        },
      });

      const updatedPolicy = await tx.policy.update({
        where: { id: policyId },
        data: {
          ...(dto.newCoverageLimit !== undefined ? { coverageLimit: dto.newCoverageLimit } : {}),
          ...(dto.newDeductible !== undefined ? { baseDeductible: dto.newDeductible } : {}),
          ...(dto.premiumDelta !== undefined
            ? { annualPremium: new Prisma.Decimal(policy.annualPremium).add(dto.premiumDelta) }
            : {}),
        },
        include: { endorsements: true, renewals: true },
      });

      return { endorsement, policy: updatedPolicy };
    });
  }

  async renewPolicy(policyId: string, actor: PolicyActorContext) {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) throw new NotFoundException(`Policy ${policyId} not found.`);
    this.assertOwnershipOrStaff(policy.policyHolderId, actor);
    if (policy.lifecycleStatus === PolicyLifecycleStatus.CANCELLED) {
      throw new BadRequestException('Cancelled policies cannot be renewed.');
    }

    const newStart = new Date(policy.endDate);
    const newEnd = new Date(newStart);
    newEnd.setFullYear(newEnd.getFullYear() + 1);

    return this.prisma.$transaction(async (tx) => {
      const renewal = await tx.policyRenewal.create({
        data: {
          policyId,
          renewalNumber: this.generateCode('RNW'),
          previousEndDate: policy.endDate,
          newStartDate: newStart,
          newEndDate: newEnd,
          renewalPremium: policy.annualPremium,
          status: 'COMPLETED',
          renewedById: actor.id,
        },
      });

      const updatedPolicy = await tx.policy.update({
        where: { id: policyId },
        data: {
          startDate: newStart,
          endDate: newEnd,
          isActive: true,
          lifecycleStatus: PolicyLifecycleStatus.ACTIVE,
        },
        include: { endorsements: true, renewals: true },
      });

      return { renewal, policy: updatedPolicy };
    });
  }

  async cancelPolicy(policyId: string, dto: CancelPolicyDto, actor: PolicyActorContext) {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) throw new NotFoundException(`Policy ${policyId} not found.`);
    this.assertOwnershipOrStaff(policy.policyHolderId, actor);

    return this.prisma.$transaction(async (tx) => {
      await tx.policyEndorsement.create({
        data: {
          policyId,
          endorsementType: 'CANCELLATION',
          description: `Cancelled: ${dto.reason}`,
          premiumDelta: 0,
          changesJson: { reason: dto.reason, cancelledBy: actor.id },
          approvedById: actor.id,
        },
      });

      return tx.policy.update({
        where: { id: policyId },
        data: {
          isActive: false,
          lifecycleStatus: PolicyLifecycleStatus.CANCELLED,
        },
        include: { endorsements: true, renewals: true },
      });
    });
  }
}
