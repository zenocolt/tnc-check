import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { connectToDatabase, dbName, getCollection, mongoose, toObjectId } from './db.js';
import Attendance from '../models/Attendance.js';
import Department from '../models/Department.js';
import Student from '../models/Student.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || process.env.MONGO_API_PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const normalizeDocument = (doc) => {
  if (!doc) return null;
  return {
    ...doc,
    id: String(doc._id),
    _id: String(doc._id),
  };
};

const sanitizePayload = (payload = {}) => {
  const clean = { ...payload };
  delete clean.id;
  delete clean._id;
  return clean;
};

const buildSort = (sortValue) => {
  if (!sortValue) return { created_date: -1 };
  const field = sortValue.startsWith('-') ? sortValue.slice(1) : sortValue;
  const direction = sortValue.startsWith('-') ? -1 : 1;
  return { [field]: direction };
};

const parseLimit = (value, fallback = 1000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, 10000);
};

const buildFilter = (filter = {}) => {
  const normalized = {};
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      normalized[key] = value;
    }
  });
  return normalized;
};

const isObjectIdLike = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.toString === 'function') return value.toString();
  return String(value);
};

const toEntityResponse = (doc) => {
  if (!doc) return null;
  return {
    ...doc,
    id: normalizeId(doc._id),
    _id: normalizeId(doc._id),
  };
};

const serializeDepartment = (doc) => toEntityResponse(doc);

const serializeStudent = (doc) => {
  const item = toEntityResponse(doc);
  const departmentValue = item.department && typeof item.department === 'object' ? item.department : null;

  return {
    ...item,
    department: departmentValue?.name || item.department_name || '',
    department_id: departmentValue ? normalizeId(departmentValue._id || departmentValue.id) : normalizeId(item.department_id || item.department),
  };
};

const serializeAttendance = (doc) => {
  const item = toEntityResponse(doc);
  const studentValue = item.student && typeof item.student === 'object' ? item.student : null;
  const departmentValue = studentValue?.department && typeof studentValue.department === 'object' ? studentValue.department : null;

  return {
    ...item,
    student: studentValue ? normalizeId(studentValue._id || studentValue.id) : normalizeId(item.student),
    student_ref: studentValue ? normalizeId(studentValue._id || studentValue.id) : normalizeId(item.student),
    student_id: studentValue?.student_id || item.student_id || '',
    student_name: item.student_name || [studentValue?.first_name, studentValue?.last_name].filter(Boolean).join(' ').trim(),
    department: departmentValue?.name || item.department || '',
    level: studentValue?.level || item.level || '',
    year: studentValue?.year || item.year || '',
    group: studentValue?.group || item.group || '',
    note: item.note || '',
  };
};

const modelConfigs = {
  Department: {
    model: Department,
    serialize: serializeDepartment,
    sortFallback: { created_date: -1 },
  },
  Student: {
    model: Student,
    serialize: serializeStudent,
    populate: [{ path: 'department' }],
    sortFallback: { created_date: -1 },
  },
  Attendance: {
    model: Attendance,
    serialize: serializeAttendance,
    populate: [{ path: 'student', populate: { path: 'department' } }],
    sortFallback: { date: -1 },
  },
};

const resolveDepartment = async (value) => {
  if (!value) {
    throw new Error('Department is required');
  }

  if (isObjectIdLike(value)) {
    const byId = await Department.findById(value);
    if (byId) return byId;
  }

  const name = typeof value === 'string' ? value.trim() : value?.name?.trim();
  if (!name) {
    throw new Error('Department name is required');
  }

  let department = await Department.findOne({ name });
  if (!department) {
    department = await Department.create({ name });
  }
  return department;
};

const resolveStudent = async (value) => {
  if (!value) {
    throw new Error('Student reference is required');
  }

  if (isObjectIdLike(value)) {
    const byId = await Student.findById(value);
    if (byId) return byId;
  }

  const code = typeof value === 'string' ? value.trim() : value?.student_id?.trim();
  if (!code) {
    throw new Error('Student ID is required');
  }

  const student = await Student.findOne({ student_id: code });
  if (!student) {
    throw new Error(`Student not found: ${code}`);
  }
  return student;
};

const prepareDepartmentPayload = async (payload, { partial = false } = {}) => {
  const clean = sanitizePayload(payload);
  const next = {};

  if (clean.name !== undefined || !partial) next.name = clean.name?.trim();
  if (clean.code !== undefined || !partial) next.code = clean.code?.trim() || '';

  return next;
};

const prepareStudentPayload = async (payload, { partial = false } = {}) => {
  const clean = sanitizePayload(payload);
  const next = {};

  if (clean.student_id !== undefined || !partial) next.student_id = clean.student_id?.trim();
  if (clean.title !== undefined || !partial) next.title = clean.title?.trim() || '';
  if (clean.first_name !== undefined || !partial) next.first_name = clean.first_name?.trim();
  if (clean.last_name !== undefined || !partial) next.last_name = clean.last_name?.trim();
  if (clean.level !== undefined || !partial) next.level = clean.level?.trim() || 'ปวช.';
  if (clean.year !== undefined || !partial) next.year = clean.year?.trim() || '1';
  if (clean.group !== undefined || !partial) next.group = clean.group?.trim() || '';
  if (clean.advisor_email !== undefined || !partial) next.advisor_email = clean.advisor_email?.trim() || '';

  if (clean.department !== undefined || clean.department_id !== undefined || !partial) {
    const department = await resolveDepartment(clean.department_id || clean.department);
    next.department = department._id;
  }

  return next;
};

const prepareAttendancePayload = async (payload, { partial = false } = {}) => {
  const clean = sanitizePayload(payload);
  const next = {};

  if (clean.date !== undefined || !partial) next.date = clean.date;
  if (clean.status !== undefined || !partial) next.status = clean.status;
  if (clean.note !== undefined || !partial) next.note = clean.note?.trim() || '';
  if (clean.recorded_by !== undefined || !partial) next.recorded_by = clean.recorded_by?.trim() || '';

  if (clean.student !== undefined || clean.student_ref !== undefined || clean.student_id !== undefined || !partial) {
    const student = await resolveStudent(clean.student_ref || clean.student || clean.student_id);
    next.student = student._id;
  }

  return next;
};

const payloadPreparers = {
  Department: prepareDepartmentPayload,
  Student: prepareStudentPayload,
  Attendance: prepareAttendancePayload,
};

const buildModelFilter = async (entityName, filter = {}) => {
  const clean = buildFilter(filter);

  if (entityName === 'Student' && clean.department) {
    const department = await resolveDepartment(clean.department);
    clean.department = department._id;
  }

  if (entityName === 'Attendance' && clean.student_id) {
    const student = await resolveStudent(clean.student_id);
    clean.student = student._id;
    delete clean.student_id;
  }

  return clean;
};

const runModelQuery = async (entityName, mode, req) => {
  const config = modelConfigs[entityName];
  if (!config) return null;

  const sort = buildSort(req.query.sort);
  const limit = parseLimit(req.query.limit);
  let query;

  if (mode === 'list') {
    query = config.model.find({});
  } else {
    query = config.model.find(await buildModelFilter(entityName, req.body?.filter));
  }

  query.sort(Object.keys(sort).length ? sort : config.sortFallback).limit(limit).lean();

  if (config.populate) {
    config.populate.forEach((populate) => query.populate(populate));
  }

  const items = await query.exec();
  return items.map(config.serialize);
};

const createModelRecord = async (entityName, payload) => {
  const config = modelConfigs[entityName];
  if (!config) return null;

  const prepared = await payloadPreparers[entityName](payload);
  const created = await config.model.create(prepared);
  const query = config.model.findById(created._id).lean();
  if (config.populate) {
    config.populate.forEach((populate) => query.populate(populate));
  }
  const item = await query.exec();
  return config.serialize(item);
};

const bulkCreateModelRecords = async (entityName, items) => {
  const config = modelConfigs[entityName];
  if (!config) return null;

  const preparedItems = [];
  for (const item of items) {
    preparedItems.push(await payloadPreparers[entityName](item));
  }

  const created = await config.model.insertMany(preparedItems, { ordered: true });
  const ids = created.map((item) => item._id);
  const query = config.model.find({ _id: { $in: ids } }).lean();
  if (config.populate) {
    config.populate.forEach((populate) => query.populate(populate));
  }
  const results = await query.exec();
  return results.map(config.serialize);
};

const updateModelRecord = async (entityName, id, payload) => {
  const config = modelConfigs[entityName];
  if (!config) return null;

  const prepared = await payloadPreparers[entityName](payload, { partial: true });
  await config.model.findByIdAndUpdate(id, prepared, {
    new: true,
    runValidators: true,
  });
  const query = config.model.findById(id).lean();
  if (config.populate) {
    config.populate.forEach((populate) => query.populate(populate));
  }
  const item = await query.exec();
  return config.serialize(item);
};

const deleteModelRecord = async (entityName, id) => {
  const config = modelConfigs[entityName];
  if (!config) return false;
  await config.model.findByIdAndDelete(id);
  return true;
};

app.get('/mongo-api/health', (_req, res) => {
  res.json({ ok: true, db: dbName });
});

app.get('/mongo-api/class-report/:department/:level/:year/:group', async (req, res) => {
  try {
    const departmentName = decodeURIComponent(req.params.department || '').trim();
    const level = decodeURIComponent(req.params.level || '').trim();
    const year = String(req.params.year || '').trim();
    const group = String(req.params.group || '').trim();

    if (!departmentName || !level || !year || !group) {
      res.status(400).json({ error: 'Missing room parameters' });
      return;
    }

    const department = await Department.findOne({ name: departmentName }).lean();
    if (!department) {
      res.json({
        room: { department: departmentName, level, year, group },
        students: [],
        attendance: [],
      });
      return;
    }

    const studentsQuery = Student.find({
      department: department._id,
      level,
      year,
      group,
    })
      .sort({ student_id: 1 })
      .populate({ path: 'department' })
      .lean();

    const students = await studentsQuery.exec();
    const serializedStudents = students.map(serializeStudent);

    const studentIds = students.map((s) => s._id);
    const attendanceQuery = Attendance.find({
      student: { $in: studentIds },
    })
      .sort({ date: -1, created_date: -1 })
      .populate({ path: 'student', populate: { path: 'department' } })
      .lean();

    const attendance = studentIds.length > 0 ? await attendanceQuery.exec() : [];
    const serializedAttendance = attendance.map(serializeAttendance);

    res.json({
      room: {
        department: departmentName,
        level,
        year,
        group,
      },
      students: serializedStudents,
      attendance: serializedAttendance,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/mongo-api/health/details', async (_req, res) => {
  const startedAt = Date.now();
  const details = {
    ok: true,
    db: dbName,
    environment: {
      hasMongoUri: Boolean(process.env.MONGODB_URI),
      hasDbName: Boolean(process.env.MONGODB_DB_NAME),
    },
    connection: {
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || dbName,
    },
    permissions: {
      read: { ok: false, error: null },
      write: { ok: false, error: null },
      delete: { ok: false, error: null },
    },
    models: {
      Department: { count: 0, error: null },
      Student: { count: 0, error: null },
      Attendance: { count: 0, error: null },
    },
    ping: {
      ok: false,
      error: null,
    },
    latencyMs: 0,
  };

  try {
    await connectToDatabase();

    try {
      await mongoose.connection.db.admin().command({ ping: 1 });
      details.ping.ok = true;
    } catch (error) {
      details.ping.ok = false;
      details.ping.error = error.message;
      details.ok = false;
    }

    try {
      await Department.findOne().lean();
      details.permissions.read.ok = true;
    } catch (error) {
      details.permissions.read.ok = false;
      details.permissions.read.error = error.message;
      details.ok = false;
    }

    try {
      const tempCollection = getCollection('__healthcheck_temp');
      const marker = {
        probe: true,
        createdAt: new Date().toISOString(),
      };
      const insertResult = await tempCollection.insertOne(marker);
      details.permissions.write.ok = Boolean(insertResult.insertedId);

      const deleteResult = await tempCollection.deleteOne({ _id: insertResult.insertedId });
      details.permissions.delete.ok = deleteResult.deletedCount === 1;

      if (!details.permissions.write.ok || !details.permissions.delete.ok) {
        details.ok = false;
      }
    } catch (error) {
      details.permissions.write.ok = false;
      details.permissions.delete.ok = false;
      details.permissions.write.error = error.message;
      details.permissions.delete.error = error.message;
      details.ok = false;
    }

    try {
      details.models.Department.count = await Department.countDocuments();
    } catch (error) {
      details.models.Department.error = error.message;
      details.ok = false;
    }

    try {
      details.models.Student.count = await Student.countDocuments();
    } catch (error) {
      details.models.Student.error = error.message;
      details.ok = false;
    }

    try {
      details.models.Attendance.count = await Attendance.countDocuments();
    } catch (error) {
      details.models.Attendance.error = error.message;
      details.ok = false;
    }

    details.connection.readyState = mongoose.connection.readyState;
    details.connection.host = mongoose.connection.host || null;
    details.connection.name = mongoose.connection.name || dbName;
    details.latencyMs = Date.now() - startedAt;

    res.status(details.ok ? 200 : 503).json(details);
  } catch (error) {
    details.ok = false;
    details.latencyMs = Date.now() - startedAt;
    res.status(503).json({
      ...details,
      error: error.message,
    });
  }
});

app.get('/mongo-api/entities/:entity', async (req, res) => {
  try {
    const modelItems = await runModelQuery(req.params.entity, 'list', req);
    if (modelItems) {
      res.json(modelItems);
      return;
    }

    const collection = getCollection(req.params.entity);
    const items = await collection
      .find({})
      .sort(buildSort(req.query.sort))
      .limit(parseLimit(req.query.limit))
      .toArray();
    res.json(items.map(normalizeDocument));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/mongo-api/entities/:entity/filter', async (req, res) => {
  try {
    const modelItems = await runModelQuery(req.params.entity, 'filter', req);
    if (modelItems) {
      res.json(modelItems);
      return;
    }

    const collection = getCollection(req.params.entity);
    const items = await collection
      .find(buildFilter(req.body?.filter))
      .sort(buildSort(req.query.sort))
      .limit(parseLimit(req.query.limit))
      .toArray();
    res.json(items.map(normalizeDocument));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/mongo-api/entities/:entity', async (req, res) => {
  try {
    const createdModelItem = await createModelRecord(req.params.entity, req.body);
    if (createdModelItem) {
      res.status(201).json(createdModelItem);
      return;
    }

    const collection = getCollection(req.params.entity);
    const now = new Date().toISOString();
    const payload = {
      ...sanitizePayload(req.body),
      created_date: req.body?.created_date || now,
      updated_date: now,
    };
    const result = await collection.insertOne(payload);
    const created = await collection.findOne({ _id: result.insertedId });
    res.status(201).json(normalizeDocument(created));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/mongo-api/entities/:entity/bulk', async (req, res) => {
  try {
    const createdModelItems = await bulkCreateModelRecords(req.params.entity, Array.isArray(req.body?.items) ? req.body.items : []);
    if (createdModelItems) {
      res.status(201).json(createdModelItems);
      return;
    }

    const collection = getCollection(req.params.entity);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const now = new Date().toISOString();
    const payload = items.map((item) => ({
      ...sanitizePayload(item),
      created_date: item?.created_date || now,
      updated_date: now,
    }));

    if (payload.length === 0) {
      res.json([]);
      return;
    }

    const result = await collection.insertMany(payload);
    const ids = Object.values(result.insertedIds);
    const created = await collection.find({ _id: { $in: ids } }).toArray();
    res.status(201).json(created.map(normalizeDocument));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/mongo-api/entities/:entity/:id', async (req, res) => {
  try {
    const updatedModelItem = await updateModelRecord(req.params.entity, req.params.id, req.body);
    if (updatedModelItem) {
      res.json(updatedModelItem);
      return;
    }

    const collection = getCollection(req.params.entity);
    const id = toObjectId(req.params.id);
    const payload = {
      ...sanitizePayload(req.body),
      updated_date: new Date().toISOString(),
    };
    await collection.updateOne({ _id: id }, { $set: payload });
    const updated = await collection.findOne({ _id: id });
    res.json(normalizeDocument(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/mongo-api/entities/:entity/:id', async (req, res) => {
  try {
    const deletedModelItem = await deleteModelRecord(req.params.entity, req.params.id);
    if (deletedModelItem) {
      res.status(204).send();
      return;
    }

    const collection = getCollection(req.params.entity);
    const id = toObjectId(req.params.id);
    await collection.deleteOne({ _id: id });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const startServer = async () => {
  try {
    await connectToDatabase();
    app.listen(port, () => {
      console.log(`Mongo API listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB with Mongoose:', error.message);
    process.exit(1);
  }
};

startServer();
