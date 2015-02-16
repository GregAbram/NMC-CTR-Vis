from TDD import TDD
import pymongo, sys, pdb, numpy
from bson import Code

class VDB:
    def __init__(self, host = None, user = None, pw = None):
        try:
            self.mongo = pymongo.MongoClient(host)
            self.user  = user
            self.pw    = pw
        except:
            raise Exception('unable to attach to database server on host %s' % (host))
        
    def linkdetails(self, varname):
        try: 
            db = self.access(varname.database)
            
            info = []
            
            for entry in db['links'].find():
                info.append([entry['id'], entry[varname.table]])
            
            info = sorted(info, key=lambda a: a[0])
            
            linkids = [i[0] for i in info]
            values = [i[1] for i in info]
        except: 
            raise Exception('error loading linkdetails')

        return TDD(-1, linkids, [-1], [values])

        
    def access(self, database):
        try: 
            db = self.mongo[database]
            db.authenticate(str(self.user), str(self.pw))
        except: 
            raise Exception('unable to authenticate database %s as %s' % (database, self.user))
        
        return db
    
    def _get_info(self, varname):
    
        db = self.access(varname.database)
 
        try:
            entry = db['Variables'].find_one({"name": str(varname.table)})
        except: 
            raise Exception('unable to access variable table %s in database' % (varname.table, varname.database))
    
        delta_t = entry['delta_t']
        
        if 'units' in entry:
            units = entry['units']
        else:
            units = ""
            
        try: 
            linkids = db[str(varname.table)].find_one({'timestep': {'$exists': False}})['linkids']
        except: 
            raise Exception('unable to access LinkIndex table')
    
        return (db, delta_t, units, linkids)
    
    def _pull(self, db, table, query):
        try: 
            timesteps = []
            data = []
            for entry in db[table].find(query):
                timesteps.append(entry['timestep'])
                data.append(entry['row'])
        except: 
            raise 
        return (timesteps, data)

    def pull(self, varname):
        if varname.operator == 'sum':
            return self.interval_sum(varname)
        elif varname.operator == 'avg':
            return self.interval_avg(varname)
        elif varname.operator == 'min':
            return self.interval_min(varname)
        elif varname.operator == 'max':
            return self.interval_max(varname)
        elif varname.operator == 'delta':
            return self.interval_delta(varname)
        elif varname.operator == 'none':
            try:
                db, delta_t, units, linkids = self._get_info(varname)
                timesteps, data =  self._pull(db, varname.table, {'timestep': {"$gte": 0}})
            except: 
                raise Exception('error unable to pull collection %s from database' % (varname.table, varname.database))
            return TDD(delta_t, linkids, [t / 60.0 for t in timesteps], data, units)
        else:
            raise Exception('Invalid aggregation operator' + varname.varname)

    def interval_sum(self, varname):
        try:
            db, delta_t, units, linkids = self._get_info(varname)

            mapper   = 'function() {emit(Math.floor(this.timestep / %d), {row: this.row})}' % (varname.interval * 60)


            reducer  = 'function(key, values) {'
            reducer += '  row = values[0].row;'
            reducer += '  for (var v = 1; v < values.length; v++) {'
            reducer += '    vrow = values[v].row;'
            reducer += '    for (var i = 0; i < row.length; i++)'
            reducer += '      row[i] += vrow[i];'
            reducer += '  }'
            reducer += '  values[0].row = row;'
            reducer += '  return (key, values[0]);'
            reducer += '}'

            db[varname.table].map_reduce(Code(mapper), Code(reducer), 'tmp')

            tmp = list(db['tmp'].find({'_id': {'$gte': 0}}))
            tmp.sort(key=lambda v: v['_id'])

            summed = {}
            for row in tmp:
                summed[row['_id']] = row['value']['row']

            timesteps = []
            data      = []
            for i in range(int(tmp[0]['_id']), int(tmp[-1]['_id'])+1):
                timesteps.append(i*varname.interval)
                if i in summed:
                    data.append(summed[i])
                else:
                    data.append([0] * len(linkids))
               
        except: raise Exception('error unable to sum-aggregate %s' % varname.varname)

        return TDD(varname.interval, linkids, timesteps, data, units)

    def interval_min(self, varname):
        try:
            db, delta_t, units, linkids = self._get_info(varname)

            mapper   = 'function() {emit(Math.floor(this.timestep / %d), {row: this.row})}' % (varname.interval * 60)


            reducer  = 'function(key, values) {'
            reducer += '  row = values[0].row;'
            reducer += '  for (var v = 1; v < values.length; v++) {'
            reducer += '    for (var i = 0; i < values[0].row.length; i++)'
            reducer += '      if (values[0].row[i] > values[v].row[i])'
            reducer += '          values[0].row[i] = values[v].row[i];'
            reducer += '  }'
            reducer += '  return (key, values[0]);'
            reducer += '}'

            db[varname.table].map_reduce(Code(mapper), Code(reducer), 'tmp')

            tmp = list(db['tmp'].find({'_id': {'$gte': 0}}))
            tmp.sort(key=lambda v: v['_id'])

            summed = {}
            for row in tmp:
                summed[row['_id']] = row['value']['row']

            timesteps = []
            data      = []
            for i in range(int(tmp[0]['_id']), int(tmp[-1]['_id'])+1):
                timesteps.append(i*varname.interval)
                if i in summed:
                    data.append(summed[i])
                else:
                    data.append([0] * len(linkids))
               
        except: raise Exception('error unable to sum-aggregate %s' % varname.varname)

        return TDD(varname.interval, linkids, timesteps, data, units)

    def interval_max(self, varname):
        try:
            db, delta_t, units, linkids = self._get_info(varname)

            mapper   = 'function() {emit(Math.floor(this.timestep / %d), {row: this.row})}' % (varname.interval * 60)


            reducer  = 'function(key, values) {'
            reducer += '  row = values[0].row;'
            reducer += '  for (var v = 1; v < values.length; v++) {'
            reducer += '    for (var i = 0; i < values[0].row.length; i++)'
            reducer += '      if (values[0].row[i] < values[v].row[i])'
            reducer += '          values[0].row[i] = values[v].row[i];'
            reducer += '  }'
            reducer += '  return (key, values[0]);'
            reducer += '}'

            db[varname.table].map_reduce(Code(mapper), Code(reducer), 'tmp')

            tmp = list(db['tmp'].find({'_id': {'$gte': 0}}))
            tmp.sort(key=lambda v: v['_id'])

            summed = {}
            for row in tmp:
                summed[row['_id']] = row['value']['row']

            timesteps = []
            data      = []
            for i in range(int(tmp[0]['_id']), int(tmp[-1]['_id'])+1):
                timesteps.append(i*varname.interval)
                if i in summed:
                    data.append(summed[i])
                else:
                    data.append([0] * len(linkids))
               
        except: raise Exception('error unable to sum-aggregate %s' % varname.varname)

        return TDD(varname.interval, linkids, timesteps, data, units)

    def interval_avg(self, varname):
        try:
            db, delta_t, units, linkids = self._get_info(varname)

            mapper   = 'function() {'
            mapper  +=     "if (typeof(this.row) != 'undefined')"
            mapper  +=         'emit(Math.floor(this.timestep / %d), {count: 1, row: this.row})' % (varname.interval * 60)
            mapper  += '}'

            reducer  = 'function(key, values) {'
            reducer +=     'knt = values[0].count;'
            reducer +=     'row = values[0].row;'
            reducer +=     'for (var i = 1; i < values.length; i++) {'
            reducer +=         'for (var j = 0; j < values[i].row.length; j++)'
            reducer +=             'values[0].row[j] += values[i].row[j];'
            reducer +=         'values[0].count += values[i].count;'
            reducer +=     '}'
            reducer +=        'return (key, values[0]);'
            reducer += '}'

            try:
                db[varname.table].map_reduce(Code(mapper), Code(reducer), 'tmp')
            except Exception as e:
                pass

            tmp = list(db['tmp'].find({'_id': {'$gte': 0}}))
            tmp.sort(key=lambda v: v['_id'])

            summed = {}
            for row in tmp:
                summed[row['_id']] = {'count': row['value']['count'], 'row': row['value']['row']}

            timesteps = []
            data      = []
            for i in range(int(tmp[0]['_id']), int(tmp[-1]['_id'])+1):
                timesteps.append(i*varname.interval)
                if i in summed:
                    d = 1.0 / summed[i]['count']
                    data.append([j*d for j in summed[i]['row']])
                else:
                    data.append([0]*len(linkids))

        except: 
            raise Exception('error unable to avg-aggregate %s' % varname.varname)

        return TDD(varname.interval, linkids, timesteps, data, units)

    def interval_delta(self, varname):
        try:
            db, delta_t, units, linkids = self._get_info(varname)
			
            mapper   = 'function() {'
            mapper  +=     't = this.timestep / %d;' % (varname.interval * 60)
            mapper  +=     'if (t == Math.floor(t))'
            mapper  +=         'emit(t, {timestep: this.timestep, row: this.row})'
            mapper  += '}'
            
            reducer  = 'function(key, values) {'
            reducer +=     'return (key, values);'
            reducer += '}'

            db[varname.table].map_reduce(Code(mapper), Code(reducer), 'tmp')

            tmp = list(db['tmp'].find({'_id': {'$gte': 0}}))
            tmp.sort(key=lambda v: v['_id'])

            data = []
            for row in tmp:
                data.append(row['value']['row'])

            data = numpy.array(data).reshape(len(data), len(linkids))
            data = numpy.vstack((data[1:,:] - data[:-1,:], numpy.zeros(len(linkids))))
            timesteps = [varname.interval*i for i in range(data.shape[0])]

        except: raise Exception('error unable to delta-aggregate %s' % varname.varname)

        return TDD(varname.interval, linkids, timesteps, data, units)

    def push(self, tdd, varname):

        db = self.access(varname.database)

        if 0 ==  db['Variables'].find({'name': varname.table}).count():
            db['Variables'].insert({'name': varname.table, 'delta_t':  tdd.delta_t, 'units': tdd.units})
        else:
            db['Variables'].update({'name': varname.table}, {'$set': {'delta_t': tdd.delta_t, 'units': tdd.units}})
            db[varname.table].drop()

        if tdd.type == TDD.IS_FLOAT64:
            self.data = tdd.data.astype('float64')
        elif tdd.type == TDD.IS_FLOAT32:
            self.data = tdd.data.astype('float32')
        else:
            self.data = tdd.data.astype('int')

        rows = [{'linkids': tdd.linkids}]
        for j in range(tdd.data.shape[0]):
            rows.append({'timestep': tdd.timesteps[j] * 60, 'row': tdd.data[j,:].tolist()})

        i = 0
        while i < len(rows):
            j = i + 100
            if j > len(rows): j = len(rows)
            db[varname.table].insert(rows[i:j])
            print 'inserted', i, 'through', j
            i = j
