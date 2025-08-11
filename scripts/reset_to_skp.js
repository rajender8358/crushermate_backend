// One-off maintenance script to reset data and create SKP org and users
require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
});

const mongoose = require('mongoose');
const path = require('path');

// Load models from backend src
const Organization = require(path.join(
  __dirname,
  '..',
  'src',
  'models',
  'Organization',
));
const User = require(path.join(__dirname, '..', 'src', 'models', 'User'));
const TruckEntry = require(path.join(
  __dirname,
  '..',
  'src',
  'models',
  'TruckEntry',
));
const OtherExpense = require(path.join(
  __dirname,
  '..',
  'src',
  'models',
  'OtherExpense',
));

async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('❌ MONGODB_URI not set in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✅ Connected to MongoDB');
}

async function removeOrganizationsByNames(namesOrRegex) {
  const conditions = namesOrRegex.map(n =>
    typeof n === 'string' ? { name: n } : { name: n },
  );
  const orgs = await Organization.find({ $or: conditions });
  if (orgs.length === 0) {
    console.log('ℹ️ No matching organizations found to remove');
    return [];
  }

  const orgIds = orgs.map(o => o._id);
  console.log(`🗑️ Removing organizations: ${orgs.map(o => o.name).join(', ')}`);

  // Delete related entries and expenses first
  const [entriesRes, expensesRes] = await Promise.all([
    TruckEntry.deleteMany({ organization: { $in: orgIds } }),
    OtherExpense.deleteMany({ organization: { $in: orgIds } }),
  ]);
  console.log(`   • Deleted Truck Entries: ${entriesRes.deletedCount}`);
  console.log(`   • Deleted Other Expenses: ${expensesRes.deletedCount}`);

  // Delete users belonging to those orgs as well
  const usersRes = await User.deleteMany({ organization: { $in: orgIds } });
  console.log(`   • Deleted Users in those orgs: ${usersRes.deletedCount}`);

  // Finally delete organizations
  const orgRes = await Organization.deleteMany({ _id: { $in: orgIds } });
  console.log(`   • Deleted Organizations: ${orgRes.deletedCount}`);

  return orgIds;
}

async function removeSpecificUsers(usernames) {
  const res = await User.deleteMany({ username: { $in: usernames } });
  console.log(
    `🗑️ Deleted users [${usernames.join(', ')}]: ${res.deletedCount}`,
  );
}

async function createSkpOrganizationAndUsers() {
  const OWNER_USERNAME = 'SKP_owner';
  const USER_USERNAME = 'SKP_user';
  const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'Test@123';

  // Safety: remove if exist with same usernames
  await removeSpecificUsers([OWNER_USERNAME, USER_USERNAME]);

  const owner = await User.create({
    username: OWNER_USERNAME,
    password: DEFAULT_PASSWORD,
    role: 'owner',
  });

  const org = await Organization.create({
    name: 'SKP',
    owner: owner._id,
    members: [owner._id],
  });

  owner.organization = org._id;
  await owner.save();

  const user = await User.create({
    username: USER_USERNAME,
    password: DEFAULT_PASSWORD,
    role: 'user',
    organization: org._id,
  });

  org.members.push(user._id);
  await org.save();

  console.log('✅ Created organization and users:');
  console.log(`   • Organization: ${org.name} (${org._id})`);
  console.log(`   • Owner: ${owner.username}`);
  console.log(`   • User: ${user.username}`);
}

async function main() {
  try {
    await connectDB();

    // 1) Remove Suresh crusher and SKP organizations
    const namesOrRegex = [/^suresh.*crush/i, /^suresh\s*crusher$/i, /^skp$/i];
    await removeOrganizationsByNames(namesOrRegex);

    // 2) Remove specific users
    await removeSpecificUsers(['suresh_owner', 'suresh_user']);

    // 3) Create SKP org and users
    await createSkpOrganizationAndUsers();

    console.log('\n🎉 Done.');
  } catch (err) {
    console.error('❌ Script failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
}

main();
