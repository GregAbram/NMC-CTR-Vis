import pdb
import struct
import numpy
from cStringIO import StringIO

hdr_desc = [('nrows',           'int32'),
           ('ncols',            'int32'),
           ('delta_t',          'float64'),
           ('datasize',         'int32'),
           ('type',             'int32'),
           ('internal_linkids', 'int32'),
           ('pad',              '(43,)int32')]

hdr_type = numpy.dtype(hdr_desc)


class TDD:
    IS_FLOAT64         = 83289020
    IS_FLOAT32         = 83289021
    INTERNAL_LINKIDS   = 83289022

    def  __init__(self, delta_t = None, linkids = None, timesteps = None, data = None, units = ""):
        self.delta_t   = delta_t
        self.linkids   = linkids
        self.timesteps = timesteps
        self.units     = units
        
        if data != None:
            self.data    = numpy.array(data).reshape([len(timesteps), len(linkids)])
            if type(self.data[0][0]) == numpy.float64:
                self.type = TDD.IS_FLOAT64
            elif type(self.data[0][0]) == numpy.float32:
                self.type = TDD.IS_FLOAT32
            else:
                self.type = 0
        else:
            self.data    = None
            self.type    = -1
        
        if linkids != None:
            self.check_linkid_ordering()

    def dump(self):
        if len(self.linkids) > 12:
            print 'linkids: ', self.linkids[0:4], '...', self.linkids[-4:]
            if len(self.timesteps) > 12:
                for i in range(4):
                    print self.timesteps[i], ': ', self.data[i][0:4], '...', self.data[i][-4:]
                for i in range(3): print '.'
                for i in range(4):
                    print self.timesteps[(len(self.timesteps)-4)+i], ': ', self.data[(len(self.timesteps)-4)+i][0:4], '...', self.data[(len(self.timesteps)-4)+i][-4:]
            else:
                for i in range(len(self.timesteps)):
                    print self.timesteps[i], ': ', self.data[i][0:4], '...', self.data[i][-4:]
        else:
            print 'linkids: ', self.linkids
            if len(self.timesteps) > 12:
                for i in range(4):
                    print self.timesteps[i], ': ', self.data[i]
                for i in range(3): print '.'
                for i in range(4):
                    print self.timesteps[(len(self.timesteps)-4)+i], ': ', self.data[(len(self.timesteps)-4)+i]
            else:
                for i in range(len(self.timesteps)):
                    print self.timesteps[i], ': ', self.data[i]

    @staticmethod
    def new(delta_t, linkid_filename = 'LinkIndex', units = ""):

        tdd = TDD()

        try:
            f = open(linkid_filename, "r")
            hdr = numpy.fromfile(f, hdr_type, 1)
            row_type = numpy.dtype([('junk', 'int32'), ('data', '(%d,)int32' % (hdr['ncols'][0]-1))])
            rowdata = numpy.fromfile(f, row_type, 1)
            linkids = list(rowdata[0][1])
            f.close()
        except:
            raise RuntimeError("unable to load linkid_filename: %s" % linkid_filename)


        tdd.delta_t = delta_t
        tdd.linkids = linkids
        tdd.linkid_filename = linkid_filename

        return tdd

    def append(self, ts, row):

        if hasattr(self, 'timesteps') and (ts != self.timesteps[-1]+self.delta_t):
            raise RuntimeError("unable to append timestep... invalid ts")

        if len(row) != len(self.linkids):
            raise RuntimeError("unable to append timestep... data is wrong length")

        if hasattr(self, 'data'):
            self.timesteps.append(ts)
            self.data = numpy.vstack((self.data, row))
        else:
            self.timesteps = [ts]
            self.data = numpy.array(row).reshape(1, len(row))

    @staticmethod
    def load(tdd_filename, linkid_filename = 'LinkIndex'):

        dirname = tdd_filename.rsplit('/',1)
        if len(dirname) == 2:
            dirname = dirname[0]
        else:
            dirname = '.'

        tdds = StringIO()
        try:
            tddf = open(tdd_filename, 'rb')
            tdds.write(tddf.read())
            tddf.close()
        except:
            raise RuntimeError("unable to load tdd_filename: %s" % tdd_filename)

        linkids = StringIO()
        try:
            linkidf = open(linkid_filename, 'rd')
            linkids.write(linkidf.read())
            linkidf.close()
        except:
            linkids.write("")
            pass

        return TDD.loadbuf(tdds.getvalue(), linkids.getvalue())
    
    @staticmethod
    def loadbuf(tdds, linkids):

        tdd = TDD()

        try:
            hdr = numpy.fromstring(tdds, hdr_type, 1)
            tdd.delta_t = int(hdr['delta_t'])
            off = hdr.itemsize
            if hdr['internal_linkids'] == TDD.INTERNAL_LINKIDS:

                # Note -  TDD's include a column for the timestep, but we do not store
                # the unnecessary slot in an internal LinkIndex table - hence the -1
        
                t = numpy.dtype(('int32', int(hdr['ncols']-1)))
                a = numpy.fromstring(tdds[off:off+t.itemsize], t)[0]
                off = off + t.itemsize
                tdd.linkids = a.tolist()
            else:
    
                # Note -  TDD's include a column for the timestep, which actually is in 
                # external LinkIndex files.  So we read it in and then we drop it.
        
                t = numpy.dtype(('int32', int(hdr['ncols'])))
                tdd.linkids = numpy.fromstring(linkids[off:off+t.itemsize], t)[0][1:].tolist()

            if hdr['nrows'] > 0:
                if hdr['type'] == TDD.IS_FLOAT64:
                    row_type = numpy.dtype([('ts', 'int32'), ('data', '(%d,)float64' % (hdr['ncols']-1))])
                elif hdr['type'] == TDD.IS_FLOAT32:
                    row_type = numpy.dtype([('ts', 'int32'), ('data', '(%d,)float32' % (hdr['ncols']-1))])
                else:
                    row_type = numpy.dtype([('ts', 'int32'), ('data', '(%d,)int32' % (hdr['ncols']-1))])
                rowdata = numpy.fromstring(tdds[off:], row_type, hdr['nrows'])
                tdd.timesteps = [int(a[0]) for a in rowdata]
                tdd.data = numpy.vstack([a[1] for a in rowdata])
        except:
            raise RuntimeError("unable to create tdd")

        TDD.check_linkid_ordering(tdd)

        return tdd


    def save(self, filename):
    
        if hasattr(self, 'linkids'):
            ncols = len(self.linkids)
        else:
            ncols = 0
    
        if hasattr(self, 'timesteps'):
            nrows = len(self.timesteps)
        else:
            nrows = 0

        try:
        
            if type(self.data[0][0]) == numpy.float64:
                self.type = TDD.IS_FLOAT64
            elif type(self.data[0][0]) == numpy.float32:
                self.type = TDD.IS_FLOAT32
            else:
                self.type = 0
    
            #### Note - TDD's include a column for the timestep - hence the +1

            hdr = [nrows, ncols+1, self.delta_t, nrows*ncols*4, self.type, TDD.INTERNAL_LINKIDS] + range(43)
            hdr_format = 'ii' + 'd' + 'i' + 'i' + 'i' + 'i'*(43)

            f = open(filename, 'w')
            f.write(struct.pack(hdr_format, *hdr))
            f.write(struct.pack('i'*ncols, *self.linkids))
    
            if nrows > 0:
                if type(self.data[0][0]) == numpy.float64:
                    row_format = 'i' + 'd'*ncols
                elif type(self.data[0][0]) == numpy.float32:
                    row_format = 'i' + 'f'*ncols
                else:
                    row_format = 'i' + 'i'*ncols
    
                for i in range(len(self.timesteps)):
                    row = [self.timesteps[i]] + list(self.data[i][:])
                    f.write(struct.pack(row_format, *row))
        
            f.close()
            
        except:
            raise RuntimeError("unable to save file as: %s" % filename)

    def save_to_mongo(self, db, varname):
        
        if 'LinkIndex' in db.collection_names():
            current_linkids = db['LinkIndex'].find_one()['linkids']
            if len(current_linkids) != len(self.linkids):
                raise RuntimeError("LinkIndex lists don't agree")
            else:
                for i,j in zip(current_linkids, self.linkids):
                    if i != j:
                        raise RuntimeError("LinkIndex lists don't agree")
        else:
            db['LinkIndex'].insert({'linkids': self.linkids})

        if db['Variables'].find({'name': varname}).count() == 0:
            db['Variables'].insert({'name': varname, 'delta_t': self.delta_t, 'units': self.units})
        else:
            db[varname].drop()
            db['Variables'].update({'name': varname}, {'$set': {'delta_t': self.delta_t, 'units': self.units}})
        
            if self.type == TDD.IS_FLOAT64:
                data = self.data.astype('float64')
            elif self.type == TDD.IS_FLOAT32:
                data = self.data.astype('float32')
            else:
                data = self.data.astype('int')
        
            rows = []
            for j in range(self.data.shape[0]):
                rows.append({'timestep': self.timesteps[j], 'row': data[j,:].tolist()})
        
            i = 0
            while i < len(rows):
                j = i + 100
                if j > len(rows): j = len(rows)
                db[varname].insert(rows[i:j])
                print 'inserted', i, 'through', j
                i = j

    def check_linkid_ordering(self):

        if self.linkids != sorted(self.linkids):
            print 'resorting linkids'
            perm = [a[0] for a in sorted([[i,j] for i,j in enumerate(self.linkids)], key=lambda k: k[1])]
            self.linkids = numpy.array(self.linkids)[perm].tolist()
            
            self.data = self.data[:,perm]
