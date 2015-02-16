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

class TDM:
    IS_FLOAT64         = 83289020
    IS_FLOAT32         = 83289021
    INTERNAL_LINKIDS   = 83289022

    def  __init__(self, delta_t = None, olinkids = None, dlinkids = None, timesteps = None, data = None):
        self.delta_t   = delta_t
        self.olinkids  = olinkids
        self.dlinkids  = dlinkids
        self.timesteps = timesteps
        if data != None:
            self.data    = numpy.array(data).reshape([len(timesteps), len(linkids)])
            if type(self.data[0][0]) == numpy.float64:
                self.type = TDM.IS_FLOAT64
            elif type(self.data[0][0]) == numpy.float32:
                self.type = TDM.IS_FLOAT32
            else:
                self.type = 0
        else:
            self.data    = None
            self.type    = -1
        
    def dump(self):
        if len(self.olinkids) > 12:
            print 'olinkids: ', self.olinkids[0:4], '...', self.olinkids[-4:]
            print 'dlinkids: ', self.dlinkids[0:4], '...', self.dlinkids[-4:]
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
            print 'olinkids: ', self.olinkids
            print 'dlinkids: ', self.dlinkids
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
    def new(delta_t, linkid_filename = 'MovementIndex'):

        tdm = TDM()

        try:
            f = open(linkid_filename, "r")
            hdr = numpy.fromfile(f, hdr_type, 1)
            row_type = numpy.dtype([('junk', 'int32'), ('data', '(%d,)int32' % (hdr['ncols'][0]-1))])
            rowdata = numpy.fromfile(f, row_type, 2)
            olinkids = list(rowdata[0][1])
            dlinkids = list(rowdata[1][1])
            f.close()
        except:
            raise RuntimeError("unable to load linkid_filename: %s" % linkid_filename)


        tdm.delta_t = delta_t
        tdm.olinkids = olinkids
        tdm.dlinkids = dlinkids
        tdm.linkid_filename = linkid_filename

        return tdm

    def append(self, ts, row):

        if hasattr(self, 'timesteps') and (ts != self.timesteps[-1]+self.delta_t):
            raise RuntimeError("unable to append timestep... invalid ts")

        if len(row) != len(self.olinkids):
            raise RuntimeError("unable to append timestep... data is wrong length")

        if hasattr(self, 'data'):
            self.timesteps.append(ts)
            self.data = numpy.vstack((self.data, row))
        else:
            self.timesteps = [ts]
            self.data = numpy.array(row).reshape(1, len(row))

    @staticmethod
    def load(tdm_filename, linkid_filename = 'LinkIndex'):

        dirname = tdm_filename.rsplit('/',1)
        if len(dirname) == 2:
            dirname = dirname[0]
        else:
            dirname = '.'

	tdms = StringIO()
        try:
            tdmf = open(tdm_filename, 'rb')
            tdms.write(tdmf.read())
            tdmf.close()
        except:
            raise RuntimeError("unable to load tdm_filename: %s" % tdm_filename)

	linkids = StringIO()
        try:
            linkidf = open(linkid_filename, 'rd')
            linkids.write(linkidf.read())
            linkidf.close()
        except:
            linkids.write("")
            pass

        return TDM.loadbuf(tdms.getvalue(), linkids.getvalue())
    
    @staticmethod
    def loadbuf(tdms, linkids):

        tdm = TDM()

        try:
            hdr = numpy.fromstring(tdms, hdr_type, 1)
            tdm.delta_t = int(hdr['delta_t'])
            off = hdr.itemsize
            if hdr['internal_linkids'] == TDM.INTERNAL_LINKIDS:

		# Note -  TDM's include a column for the timestep, but we do not store
		# the unnecessary slot in an internal LinkIndex table - hence the -1

		t = numpy.dtype(('int32', int(hdr['ncols']-1)))
		a = numpy.fromstring(tdms[off:off+t.itemsize], t)[0]
		off = off + t.itemsize
		tdm.olinkids = a.tolist()
		a = numpy.fromstring(tdms[off:off+t.itemsize], t)[0]
		off = off + t.itemsize
		tdm.dlinkids = a.tolist()
	    else:

		# Note -  TDM's include a column for the timestep, which actually is in 
		# external LinkIndex files.  So we read it in and then we drop it.

		t = numpy.dtype(('int32', int(hdr['ncols'])))
		tdm.olinkids = numpy.fromstring(linkids[hdr.itemsize:hdr.itemsize+t.itemsize], t)[0][1:].tolist()
		t = numpy.dtype(('int32', int(hdr['ncols'])))
		tdm.dlinkids = numpy.fromstring(linkids[hdr.itemsize+t.itemsize:hdr.itemsize+2*t.itemsize], t)[0][1:].tolist()


            if hdr['nrows'] > 0:
                if hdr['type'] == TDM.IS_FLOAT64:
                    row_type = numpy.dtype([('ts', 'int32'), ('data', '(%d,)float64' % (hdr['ncols']-1))])
                elif hdr['type'] == TDM.IS_FLOAT32:
                    row_type = numpy.dtype([('ts', 'int32'), ('data', '(%d,)float32' % (hdr['ncols']-1))])
                else:
                    row_type = numpy.dtype([('ts', 'int32'), ('data', '(%d,)int32' % (hdr['ncols']-1))])
                rowdata = numpy.fromstring(tdms[off:], row_type, hdr['nrows'])
                tdm.timesteps = [int(a[0]) for a in rowdata]
                tdm.data = numpy.vstack([a[1] for a in rowdata])
        except:
            raise RuntimeError("unable to create tdm")

        return tdm


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
                self.type = TDM.IS_FLOAT64
            elif type(self.data[0][0]) == numpy.float32:
                self.type = TDM.IS_FLOAT32
            else:
                self.type = 0
    
	    #### Note - TDM's include a column for the timestep - hence the +1

            hdr = [nrows, ncols+1, self.delta_t, nrows*ncols*4, self.type, TDM.INTERNAL_LINKIDS] + range(43)
            hdr_format = 'ii' + 'd' + 'i' + 'i' + 'i' + 'i'*(43)

            f = open(filename, 'w')
            f.write(struct.pack(hdr_format, *hdr))
            f.write(struct.pack('i'*ncols, *self.olinkids))
            f.write(struct.pack('i'*ncols, *self.dlinkids))
    
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
        
        if 'MovementIndex' in db.collection_names():
            current_olinkids = db['MovementIndex'].find_one()['olinkids']
            current_dlinkids = db['MovementIndex'].find_one()['dlinkids']
            if (len(current_olinkids) != len(self.olinkids)) or (len(current_dlinkids) != len(self.dlinkids)):
                raise RuntimeError("MovementIndex lists don't agree")
            else:
                for i,j in zip(current_olinkids, self.olinkids):
                    if i != j:
                        raise RuntimeError("MovementIndex lists don't agree")
                for i,j in zip(current_dlinkids, self.dlinkids):
                    if i != j:
                        raise RuntimeError("MovementIndex lists don't agree")
        else:
            db['MovementIndex'].insert({'olinkids': self.olinkids})
            db['MovementIndex'].insert({'dlinkids': self.dlinkids})

 	if db['Variables'].find({'name': varname}).count() == 0:
	    db['Variables'].insert({'name': varname, 'delta_t': self.delta_t})
	else:
	    db[varname].drop()
	    db['Variables'].update({'name': varname}, {'$set': {'delta_t': self.delta_t}})
    
        if self.type == TDM.IS_FLOAT64:
            data = self.data.astype('float64')
        elif self.type == TDM.IS_FLOAT32:
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

