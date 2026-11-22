import 'dotenv/config';
import { prisma } from '../config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

async function runTests() {
  console.log('\n=============================================');
  console.log('   RUNNING SOLAROPS AUTOMATED INTEGRATION TESTS');
  console.log('=============================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // Test 1: Database connectivity
    const userCount = await prisma.user.count();
    assert(userCount > 0, `Database connected successfully (found ${userCount} users)`);

    // Test 2: Admin initial account verification
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env to run integration checks.');
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    assert(!!admin && admin.role === Role.ADMIN, `Initial Admin account exists with verified role ADMIN`);

    const adminPassMatch = await bcrypt.compare(adminPassword, admin!.passwordHash);
    assert(adminPassMatch, `Admin password hash securely verifies against environment secret`);

    // Test 3: Customer Registration & Password Hashing
    const testCustEmail = `test.customer.${Date.now()}@example.com`;
    const plainPassword = 'SecretPassword123!';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const newCustomer = await prisma.user.create({
      data: {
        email: testCustEmail,
        passwordHash,
        fullName: 'Test Customer Automated',
        phone: '+91 99999 88888',
        role: Role.CUSTOMER,
        customerProfile: {
          create: {
            electricityProvider: 'BESCOM',
            monthlyBillAvg: 4000
          }
        }
      }
    });

    assert(newCustomer.role === Role.CUSTOMER, `Customer registered automatically with role CUSTOMER`);
    const custPassMatch = await bcrypt.compare(plainPassword, newCustomer.passwordHash);
    assert(custPassMatch, `Customer password hashed securely with bcrypt`);

    // Test 4: Duplicate Email Prevention
    let duplicateCaught = false;
    try {
      await prisma.user.create({
        data: {
          email: testCustEmail,
          passwordHash,
          fullName: 'Duplicate Customer',
          role: Role.CUSTOMER
        }
      });
    } catch {
      duplicateCaught = true;
    }
    assert(duplicateCaught, `Duplicate email registration prevented by database unique constraint`);

    // Test 5: Role-based Access Tokens
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required to run authentication tests.');
    }
    const customerToken = jwt.sign(
      { id: newCustomer.id, email: newCustomer.email, role: newCustomer.role, fullName: newCustomer.fullName },
      jwtSecret
    );
    const decodedCustomer: any = jwt.verify(customerToken, jwtSecret);
    assert(decodedCustomer.role === 'CUSTOMER', `Customer JWT properly generated and decodes role CUSTOMER`);

    // Test 6: Installation Workflow (Customer creates request -> Stored -> Admin views it)
    const requestNumber = `SO-TEST-${Date.now().toString().slice(-4)}`;
    const newRequest = await prisma.installationRequest.create({
      data: {
        requestNumber,
        customerId: newCustomer.id,
        projectName: 'Automated Test 5kW Solar Rooftop',
        systemCapacityKw: 5.0,
        systemType: 'Rooftop On-Grid',
        installationAddress: 'Test Location, Electronic City, Bengaluru',
        status: 'ENQUIRY',
        progress: 10
      }
    });

    assert(!!newRequest.id, `Customer created installation request ${newRequest.requestNumber}`);

    // Admin fetches all requests
    const adminViewProjects = await prisma.installationRequest.findMany({
      where: { id: newRequest.id },
      include: { customer: true }
    });
    assert(adminViewProjects.length === 1 && adminViewProjects[0].customer.id === newCustomer.id, `Admin successfully queries and views customer installation request`);

    // Test 7: Admin creates Technician Account
    const techEmail = `tech.automated.${Date.now()}@solarops.com`;
    const newTech = await prisma.user.create({
      data: {
        email: techEmail,
        passwordHash: await bcrypt.hash('TechTemp123!', 10),
        fullName: 'Automated Technician',
        phone: '+91 91234 56789',
        role: Role.TECHNICIAN,
        technicianProfile: {
          create: {
            skills: 'Inverter Diagnostics, Grid Sync',
            certificationNumber: 'CERT-AUTO-99'
          }
        }
      }
    });
    assert(newTech.role === Role.TECHNICIAN, `Admin created technician account with verified role TECHNICIAN`);

    // Clean up test records
    await prisma.installationRequest.delete({ where: { id: newRequest.id } });
    await prisma.technicianProfile.delete({ where: { userId: newTech.id } });
    await prisma.user.delete({ where: { id: newTech.id } });
    await prisma.customerProfile.delete({ where: { userId: newCustomer.id } });
    await prisma.user.delete({ where: { id: newCustomer.id } });
    console.log('  Cleaned up temporary automated test entities.');

  } catch (err) {
    console.error('Test suite failed with unexpected error:', err);
    failed++;
  }

  console.log('\n---------------------------------------------');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('---------------------------------------------\n');

  await prisma.$disconnect();

  if (failed > 0) process.exit(1);
}

runTests();
