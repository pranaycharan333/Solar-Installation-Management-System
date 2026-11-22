import { PrismaClient, Role, ProjectStatus, EstimateStatus, PaymentStage, PaymentStatus, TicketPriority, TicketStatus, WarrantyStatus, AssignmentType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    throw new Error('Seeding deletes existing database records. Set ALLOW_DESTRUCTIVE_SEED=true only for an intentional local demo reset.');
  }
  console.log('--- Starting SolarOps Enterprise Database Seeding ---');

  // 1. Clean existing records (optional, cascade handles relations)
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.serviceTicket.deleteMany();
  await prisma.warranty.deleteMany();
  await prisma.installationPhotograph.deleteMany();
  await prisma.installationChecklist.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.siteSurvey.deleteMany();
  await prisma.technicianAssignment.deleteMany();
  await prisma.installationRequest.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.material.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.technicianProfile.deleteMany();
  await prisma.user.deleteMany();

  // 2. Hash default passwords
  const adminPass = process.env.ADMIN_PASSWORD;
  const techPass = process.env.TECHNICIAN_SEED_PASSWORD;
  const customerPass = process.env.CUSTOMER_SEED_PASSWORD;
  if (!process.env.ADMIN_EMAIL || !adminPass || !techPass || !customerPass) {
    throw new Error('Set ADMIN_EMAIL, ADMIN_PASSWORD, TECHNICIAN_SEED_PASSWORD, and CUSTOMER_SEED_PASSWORD in backend/.env before seeding.');
  }
  const adminHash = await bcrypt.hash(adminPass, 10);
  const techHash = await bcrypt.hash(techPass, 10);
  const custHash = await bcrypt.hash(customerPass, 10);

  // 3. Create Admin
  const adminEmail = process.env.ADMIN_EMAIL;
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: adminHash,
      role: Role.ADMIN,
      fullName: process.env.ADMIN_NAME || 'Pranay',
      phone: process.env.ADMIN_PHONE || '+91 98765 43210',
      address: 'SolarOps HQ, Indiranagar, Bengaluru'
    }
  });
  console.log(`✓ Admin user created: ${admin.email}`);

  // 4. Create Technicians
  const tech1 = await prisma.user.create({
    data: {
      email: 'arjun.nair@solarops.com',
      passwordHash: techHash,
      role: Role.TECHNICIAN,
      fullName: 'Arjun Nair',
      phone: '+91 98765 11223',
      address: 'HSR Layout, Bengaluru',
      technicianProfile: {
        create: {
          skills: 'Rooftop Solar, Inverter Commissioning, High-Voltage Safety',
          certificationNumber: 'MNRE-IN-7842',
          status: 'AVAILABLE'
        }
      }
    }
  });

  const tech2 = await prisma.user.create({
    data: {
      email: 'divya.rao@solarops.com',
      passwordHash: techHash,
      role: Role.TECHNICIAN,
      fullName: 'Divya Rao',
      phone: '+91 98765 22334',
      address: 'Malleshwaram, Bengaluru',
      technicianProfile: {
        create: {
          skills: 'Site Surveying, Shading Analysis, Structural Feasibility',
          certificationNumber: 'MNRE-IN-9102',
          status: 'AVAILABLE'
        }
      }
    }
  });
  console.log(`✓ Technicians created: ${tech1.fullName}, ${tech2.fullName}`);

  // 5. Create Customers
  const cust1 = await prisma.user.create({
    data: {
      email: 'meera.sharma@example.com',
      passwordHash: custHash,
      role: Role.CUSTOMER,
      fullName: 'Meera Sharma',
      phone: '+91 98451 22334',
      address: '42, 12th Main, Indiranagar, Bengaluru',
      customerProfile: {
        create: {
          electricityProvider: 'BESCOM',
          consumerNumber: 'BES-IND-90214',
          monthlyBillAvg: 4500
        }
      }
    }
  });

  const cust2 = await prisma.user.create({
    data: {
      email: 'kiran.patel@example.com',
      passwordHash: custHash,
      role: Role.CUSTOMER,
      fullName: 'Kiran Patel',
      phone: '+91 98452 33445',
      address: '15, Palm Meadows, Whitefield, Bengaluru',
      customerProfile: {
        create: {
          electricityProvider: 'BESCOM',
          consumerNumber: 'BES-WTF-44129',
          monthlyBillAvg: 3800
        }
      }
    }
  });

  const cust3 = await prisma.user.create({
    data: {
      email: 'ananya.reddy@example.com',
      passwordHash: custHash,
      role: Role.CUSTOMER,
      fullName: 'Ananya Reddy',
      phone: '+91 98453 44556',
      address: '77, 4th Block, Jayanagar, Bengaluru',
      customerProfile: {
        create: {
          electricityProvider: 'BESCOM',
          consumerNumber: 'BES-JAY-11883',
          monthlyBillAvg: 7200
        }
      }
    }
  });

  const cust4 = await prisma.user.create({
    data: {
      email: 'rahul.menon@example.com',
      passwordHash: custHash,
      role: Role.CUSTOMER,
      fullName: 'Rahul Menon',
      phone: '+91 98454 55667',
      address: '29, 5th Block, Koramangala, Bengaluru',
      customerProfile: {
        create: {
          electricityProvider: 'BESCOM',
          consumerNumber: 'BES-KOR-33019',
          monthlyBillAvg: 5100
        }
      }
    }
  });
  console.log(`✓ Customers created: Meera, Kiran, Ananya, Rahul`);

  // 6. Materials & Inventory
  const materialsData = [
    { code: 'PNL-550-M', name: 'Monocrystalline Solar Panel 550W', category: 'PANEL', unit: 'units', cost: 12500, stock: 18, reorder: 25 },
    { code: 'INV-HYB-5K', name: 'Hybrid Solar Inverter 5kW', category: 'INVERTER', unit: 'units', cost: 48000, stock: 6, reorder: 10 },
    { code: 'CAB-DC-4', name: 'DC Solar Cable 4mm² UV Resistant', category: 'ELECTRICAL', unit: 'meters', cost: 65, stock: 240, reorder: 150 },
    { code: 'STR-AL-01', name: 'Anodized Aluminium Mounting Structure (4-Panel Set)', category: 'MOUNTING', unit: 'sets', cost: 8500, stock: 22, reorder: 15 },
    { code: 'MTR-BI-3P', name: 'Bi-directional Net Meter 3-Phase', category: 'METERING', unit: 'units', cost: 9500, stock: 12, reorder: 8 },
    { code: 'SPD-DC-1000', name: 'DC Surge Protection Device 1000V', category: 'SAFETY', unit: 'units', cost: 2400, stock: 35, reorder: 20 },
  ];

  for (const m of materialsData) {
    const mat = await prisma.material.create({
      data: {
        code: m.code,
        name: m.name,
        category: m.category,
        unit: m.unit,
        unitCost: m.cost,
        inventory: {
          create: {
            quantityOnHand: m.stock,
            reorderLevel: m.reorder,
            location: 'Central Warehouse, BLR'
          }
        }
      }
    });
  }
  console.log(`✓ Materials & Inventory catalogue populated`);

  // 7. Installation Requests

  // Project 1: SO-2408 (Meera Sharma - In Progress)
  const proj1 = await prisma.installationRequest.create({
    data: {
      requestNumber: 'SO-2408',
      customerId: cust1.id,
      projectName: '6.5 kW Rooftop Solar - Indiranagar',
      systemCapacityKw: 6.5,
      systemType: 'Rooftop On-Grid',
      installationAddress: '42, 12th Main, Indiranagar, Bengaluru',
      status: ProjectStatus.INSTALLATION_IN_PROGRESS,
      progress: 72,
      notes: 'Customer approved net metering subsidy. Panels delivered.',
      assignments: {
        create: {
          technicianId: tech1.id,
          assignedBy: admin.id,
          assignmentType: AssignmentType.INSTALLATION,
          scheduledDate: new Date(),
          notes: 'Complete panel wiring and inverter mounting today.'
        }
      },
      surveys: {
        create: {
          technicianId: tech1.id,
          roofType: 'Concrete Flat Roof',
          roofAreaSqft: 650,
          shadingCondition: 'Zero shading between 9 AM and 4:30 PM',
          structuralFeasibility: 'Approved (RCC Slab 150mm)',
          electricalPanelCondition: 'Good, upgraded 3-phase MCB',
          proposedCapacityKw: 6.5,
          surveyNotes: 'Easy staircase roof access. Cable routing 22m.'
        }
      },
      estimates: {
        create: {
          estimateNumber: 'EST-2408-A',
          totalAmount: 390000,
          subsidyAmount: 78000,
          netAmount: 312000,
          status: EstimateStatus.APPROVED,
          approvedAt: new Date(Date.now() - 5 * 86400000),
          terms: 'Standard 5-year comprehensive maintenance included. PM Surya Ghar subsidy applied.'
        }
      },
      payments: {
        create: {
          amount: 75000,
          paymentStage: PaymentStage.ADVANCE,
          paymentMethod: 'UPI / Razorpay',
          transactionRef: 'TXN-SOL-90124',
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(Date.now() - 4 * 86400000)
        }
      },
      checklists: {
        createMany: {
          data: [
            { stepKey: 'SITE_INSPECTION', title: 'Site Inspection & Safety Setup', isCompleted: true, sequenceOrder: 1, completedBy: 'Arjun Nair', completedAt: new Date() },
            { stepKey: 'MOUNTING_RAILS', title: 'Mounting Rails Anchored & Torqued', isCompleted: true, sequenceOrder: 2, completedBy: 'Arjun Nair', completedAt: new Date() },
            { stepKey: 'PANEL_LAYOUT', title: 'Solar PV Modules Clamped & Grounded', isCompleted: true, sequenceOrder: 3, completedBy: 'Arjun Nair', completedAt: new Date() },
            { stepKey: 'INVERTER_WIRING', title: 'Inverter & DC/AC Disconnect Connection', isCompleted: false, sequenceOrder: 4 },
            { stepKey: 'EARTHING_TEST', title: 'Earthing Resistance Verification (< 5 Ohms)', isCompleted: false, sequenceOrder: 5 },
            { stepKey: 'NET_METERING', title: 'DISCOM Net Metering Sync & Commissioning', isCompleted: false, sequenceOrder: 6 }
          ]
        }
      }
    }
  });

  // Project 2: SO-2407 (Kiran Patel - Survey Booked)
  const proj2 = await prisma.installationRequest.create({
    data: {
      requestNumber: 'SO-2407',
      customerId: cust2.id,
      projectName: '4.2 kW Rooftop Solar - Whitefield',
      systemCapacityKw: 4.2,
      systemType: 'Rooftop On-Grid',
      installationAddress: '15, Palm Meadows, Whitefield, Bengaluru',
      status: ProjectStatus.SURVEY_SCHEDULED,
      progress: 34,
      notes: 'Site visit scheduled today at 4:00 PM.',
      assignments: {
        create: {
          technicianId: tech2.id,
          assignedBy: admin.id,
          assignmentType: AssignmentType.SURVEY,
          scheduledDate: new Date(),
          notes: 'Measure terrace area and check tree shading towards west.'
        }
      }
    }
  });

  // Project 3: SO-2406 (Ananya Reddy - Estimate Sent)
  const proj3 = await prisma.installationRequest.create({
    data: {
      requestNumber: 'SO-2406',
      customerId: cust3.id,
      projectName: '8.0 kW Commercial Rooftop - Jayanagar',
      systemCapacityKw: 8.0,
      systemType: 'Hybrid with Battery Backup',
      installationAddress: '77, 4th Block, Jayanagar, Bengaluru',
      status: ProjectStatus.ESTIMATE_SENT,
      progress: 49,
      notes: 'Estimate sent to customer for approval.',
      assignments: {
        create: {
          technicianId: tech1.id,
          assignedBy: admin.id,
          assignmentType: AssignmentType.SURVEY,
          scheduledDate: new Date(Date.now() - 2 * 86400000),
          status: 'COMPLETED'
        }
      },
      surveys: {
        create: {
          technicianId: tech1.id,
          roofType: 'Reinforced Concrete Slab',
          roofAreaSqft: 900,
          shadingCondition: 'No shading',
          structuralFeasibility: 'Heavy load capacity confirmed',
          electricalPanelCondition: 'Commercial 3-phase connection ready',
          proposedCapacityKw: 8.0,
          surveyNotes: 'Requires 16 x 550W modules and 10kWh lithium storage.'
        }
      },
      estimates: {
        create: {
          estimateNumber: 'EST-2406-B',
          totalAmount: 480000,
          subsidyAmount: 78000,
          netAmount: 402000,
          status: EstimateStatus.SENT,
          validityDays: 15,
          terms: 'Includes 10kWh battery backup system and smart mobile monitoring.'
        }
      }
    }
  });

  // Project 4: SO-2405 (Rahul Menon - Enquiry / Awaiting Approval)
  const proj4 = await prisma.installationRequest.create({
    data: {
      requestNumber: 'SO-2405',
      customerId: cust4.id,
      projectName: '5.0 kW Rooftop Solar - Koramangala',
      systemCapacityKw: 5.0,
      systemType: 'Rooftop On-Grid',
      installationAddress: '29, 5th Block, Koramangala, Bengaluru',
      status: ProjectStatus.ENQUIRY,
      progress: 15,
      notes: 'Customer submitted installation request online. Pending technician assignment.'
    }
  });

  // Project 5: SO-2401 (Completed Project with active Warranty)
  const proj5 = await prisma.installationRequest.create({
    data: {
      requestNumber: 'SO-2401',
      customerId: cust1.id,
      projectName: '3.3 kW Rooftop Solar - Indiranagar Villa',
      systemCapacityKw: 3.3,
      systemType: 'Rooftop On-Grid',
      installationAddress: '42, 12th Main, Indiranagar, Bengaluru',
      status: ProjectStatus.COMPLETED,
      progress: 100,
      notes: 'Commissioned on March 15, 2026. Handover completed.',
      payments: {
        createMany: {
          data: [
            { amount: 50000, paymentStage: PaymentStage.ADVANCE, status: PaymentStatus.COMPLETED },
            { amount: 148000, paymentStage: PaymentStage.FINAL, status: PaymentStatus.COMPLETED }
          ]
        }
      },
      warranty: {
        create: {
          customerId: cust1.id,
          certificateNumber: 'WRTY-2026-SO2401',
          systemWarrantyYears: 5,
          inverterWarrantyYears: 10,
          panelWarrantyYears: 25,
          startDate: new Date('2026-03-15'),
          endDate: new Date('2031-03-15'),
          terms: 'Comprehensive 5-year workmanship warranty with zero-cost dispatch. 25-year panel linear performance guarantee.'
        }
      }
    }
  });

  // 8. Service Tickets
  await prisma.serviceTicket.create({
    data: {
      ticketNumber: 'TKT-8801',
      customerId: cust1.id,
      projectId: proj1.id,
      issueDescription: 'Inverter monitoring app disconnects intermittently in the evening.',
      priority: TicketPriority.HIGH,
      status: TicketStatus.OPEN
    }
  });

  await prisma.serviceTicket.create({
    data: {
      ticketNumber: 'TKT-8802',
      customerId: cust4.id,
      issueDescription: 'General inquiry on solar rooftop subsidy eligibility under PM Surya Ghar Muft Bijli Yojana.',
      priority: TicketPriority.LOW,
      status: TicketStatus.RESOLVED,
      resolutionNotes: 'Customer informed of 78,000 INR national subsidy for 3kW+ systems.'
    }
  });

  // 9. Initial Audit Logs
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SYSTEM_INITIALIZATION',
      entity: 'SYSTEM',
      entityId: 'INIT-001',
      details: 'Enterprise database seeded with initial administrator, technicians, customers and material catalog.'
    }
  });

  console.log('✓ Projects, Checklists, Estimates, Warranties & Service tickets created');
  console.log('--- SolarOps Database Seeding Complete ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
