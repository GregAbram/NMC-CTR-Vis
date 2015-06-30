import pymongo

class Stop:
    def __init__(self, node, trip, attrs):
        self.node       = node
        self.trip       = trip
        self.attributes = attrs

class Segment:
    def __init__(self, link, trip, attrs):
        self.link       = link
        self.trip       = trip
        self.attributes = attrs

class Node:
    def __init__(self, nid, ntype, point, stops, attrs):
        self.nid        = nid
        self.ntype      = ntype
        self.point      = point
        self.stops      = stops
        self.attributes = attrs
        
class Link:
    def __init__(self, lid, ltype, src, dst, path, segments, attrs):
        self.lid        = lid
        self.src        = src
        self.dst        = dst
        self.ltype      = ltype
        self.path       = path
        self.segments   = segments
        self.attributes = attrs

possible_linkattrs = ['lanes', 'capacity', 'speed', 'length', 'model_length']
possible_linkattrunits = ['lanes', 'capacity', 'miles per hour', 'feet', 'feet']

possible_nodeattrs = []
possible_nodeattrunits = []

possible_segattrs = ['departure', 'elapsed', 'load']
possible_segattrunits = ['seconds', 'seconds', 'passengers']

possible_stopattrs = ['dwell', 'boarding', 'alighting']
possible_stopattrunits = ['seconds', 'passengers', 'passengers']

class Network: 

    def __init__(self, db):
        self.nodemap = {}
        self.nodes = []
        self.linkmap = {}
        self.links = []
        self.busroutes = []
        self.linktypes = ""
        self.nodetypes = ""
        self.busroutes = ""
        self.nodeattrs = []
        self.nodetypes = []
        self.linkattrs = []
        self.linkattrunits = []
        self.nodeattrs = []
        self.nodeattrunits = []
        self.segments = []
        self.stops = []
        self.stopattrs = []
        self.stopattrunits = []
        self.segattrs = []
        self.segattrunits = []
        self.trips = []
        self.routes = []
        
        if 'routes' in db.collection_names():
            for r in db['routes'].find():
                self.routes.append([r['id'], r['nodes'], r['links']])
       
        if 'trips' in db.collection_names():
            for t in db['trips'].find().sort([("tripid",pymongo.ASCENDING)]):
                self.trips.append({'id': t['trip'], 'departure': t['departure'], 'shape': t['shape'], 'route': t['route'], 'segments': t['segments'], 'stops': t['stops']})
        
        first = True
        for stop in db['stops'].find().sort([("stopid",pymongo.ASCENDING)]):
                            
            if first:
                first = False
                for i,j in enumerate(possible_stopattrs):
                    if stop.has_key(j):
                        self.stopattrs.append(possible_stopattrs[i])
                        self.stopattrunits.append(possible_stopattrunits[i])
               
            self.stops.append(Stop(stop['nodeid'], stop['trip'], [stop[i] for i in self.stopattrs]))
        
        first = True
        for seg in db['segments'].find().sort([("segmentid",pymongo.ASCENDING)]):
                            
            if first:
                first = False
                for i,j in enumerate(possible_segattrs):
                    if seg.has_key(j):
                        self.segattrs.append(possible_segattrs[i])
                        self.segattrunits.append(possible_segattrunits[i])
               
            self.segments.append(Segment(seg['linkid'], seg['trip'], [seg[i] for i in self.segattrs]))
        
        
        for indx,node in enumerate(db['nodes'].find()):
                            
            if indx == 0:
                for i,j in enumerate(possible_nodeattrs):
                    if node.has_key(j):
                        self.nodeattrs.append(possible_nodeattrs[i])
                        self.nodeattrunits.append(possible_nodeattrunits[i])

            if node.has_key('stops'):
                stops = node['stops']
            else:
                stops = []
                
            self.nodemap[node['id']] = indx
            self.nodes.append(Node(node['id'], node['type'], node['location'], stops, [node[i] for i in self.nodeattrs]))
        
        self.nodetypes = ','.join([str(i) for i in db.nodes.distinct('type')])
        
        links = list(db['links'].find())
        
        for indx,link in enumerate(links):
            lid = link['id']
            typ = link['type']
            src = link['source']
            dst = link['destination']
            pts = link['points']
            attrs = []
            
            if link.has_key('segments'):
                trips = link['segments']
            else:
                trips = []
                
            if indx == 0:
                for i,j in enumerate(possible_linkattrs):
                    if link.has_key(j):
                        self.linkattrs.append(possible_linkattrs[i])
                        self.linkattrunits.append(possible_linkattrunits[i])

            for i in self.linkattrs:
                attrs.append(link[i])
                
            self.linkmap[id] = indx          
            self.links.append(Link(lid, typ, src, dst, pts, trips, attrs))
         
        self.linktypes = ','.join([str(i) for i in db.links.distinct('type')])
        
        self.busroutes = {}
        for busroute in db['busroutes'].find():
            self.busroutes[busroute['route']] = ','.join([str(i) for i in busroute['links']])

        a = list(db['Animation'].find({'time_base': {'$exists': True}}))
        if len(a) > 0: self.time_base = a[0]['time_base']
        else: self.time_base = 0

        return
