from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.utils import simplejson 
import contour_tools
import pymongo
import numpy
from scipy.interpolate import interp1d
from visualizer.models import VisUser
from calc import Calc
import sys
import pdb

from visualizer.Network import Network
from bson import Code

# MONGO_HOST = 'localhost'
MONGO_HOST = 'nmc.tacc.utexas.edu'

def attach_mongo(request, database):
    mdb = pymongo.MongoClient(MONGO_HOST)
    vu = VisUser.objects.get(user=request.user.username)
    mdb[database].authenticate(vu.user, vu.dbpw)
    return mdb[database]
        
def list_datasets(request, database):

    try:
        db = attach_mongo(request, database)
        datasets = [i['name'] for i in db['Variables'].find()]
        return HttpResponse(simplejson.dumps({'status': 'OK', 'datasets': datasets}), mimetype='application/json')
    except:
        return HttpResponse(simplejson.dumps({'status': 'unable to query datasets'}), mimetype='application/json')

def network_page(request):
    dbs = []
    user = request.user.username
    vu = VisUser.objects.get(user=user)
    mdb = pymongo.MongoClient(MONGO_HOST)
    mdb['admin'].authenticate(vu.user, vu.dbpw)
    all_databases = mdb.database_names()
    for db in all_databases:
        if db[:len(user)] == user:
            dbs.append(db)
    return render(request, 'network.html', {"databases": dbs})

def load_OD_nodes(request, database, do_origins):

    try:
        db = attach_mongo(request, database)
    except:
        return HttpResponse(simplejson.dumps({'status': 'Unable to access network: %s' % (database)}), mimetype='application/json')
    
    if 'paths' not in db.collection_names():
        return HttpResponse(simplejson.dumps({'status': 'No path data in network: %s' % (database)}), mimetype='application/json')
       
    if int(do_origins) == 1:
        nodeids = db.paths.distinct('orig')
    else:
        nodeids = db.paths.distinct('dest')
        
    r = {'status': 'OK', 'name': database, 'nodeids': nodeids}
    rjson = simplejson.dumps(r)
    return HttpResponse(rjson, mimetype='application/json')

def load_OD_distribution_data(request, database, interval, given_origins, nodeids):

    interval = int(interval)
    
    try:
        db = attach_mongo(request, database)

        given_origins = int(given_origins)
        if int(given_origins) == 1:
            given = 'orig'
            want  = 'dest'
        else:
            given = 'dest'
            want  = 'orig'
            
        m = 'function() { emit({nodeid: this.%s, timestep: Math.floor(this.departure / %d)}, 1); }' % (want, interval*60)

        m = Code(m)
        
        r  = 'function(key, values) {'
        r += '  var t = 0;'
        r += '  for (var i in values)'
        r += '    t = t + values[i];'
        r += '  return (key, t);'
        r += '}'

        r = Code(r)

        db.paths.map_reduce(m, r, 'blah', query={given: {'$in': [int(i) for i in nodeids.split(',')]}})

        tmp = {}
        for i in db.blah.find():
            nodeid = int(i['_id']['nodeid'])
            ts = int(i['_id']['timestep'])
            value = int(i['value'])
            if ts not in tmp: tmp[ts] = []
            tmp[ts].append({'nodeid': nodeid, 'count': value})

        timestep_count = sorted(tmp.keys())[-1] + 1
        timestep_data = [[] for i in range(int(timestep_count))]
        
        for i in tmp:
            timestep_data[i] = tmp[i]
            
        max_count = 0
        min_count = 9999999
        for timestep in timestep_data:
            for i in timestep:
                j = i['count']
                if j > max_count: max_count = j
                if j < min_count: min_count = j
    
        r = {'status': 'OK', 'name': database, 'interval': interval, 'data_range': (min_count, max_count), 'number_of_timesteps': len(timestep_data), 'timesteps': [i*interval for i in range(len(timestep_data))], 'data': timestep_data}
        rjson = simplejson.dumps(r)
        return HttpResponse(rjson, mimetype='application/json')

    except:
        return HttpResponse(simplejson.dumps({'status': 'Unable to get OD distributon data'}), mimetype='application/json')

    
def load_link_paths(request, database, interval, selected_links, agg):

    try:
        db = attach_mongo(request, database)
    except:
        return HttpResponse(simplejson.dumps({'status': 'Unable to load network' %  (database)}), mimetype='application/json')

    links = [int(s) for s in selected_links[1:-1].split(',')]
    interval = int(interval)

    # First, select out paths that cross all the links

    src = 'paths'

    for i in range(len(links)):
        db['tmp_%d' % i].drop()

    for i in range(len(links)):
        dst = 'tmp_%d' % i 
        buf = []
        for i in db[src].find({"path": {"$in": [links[i]]}}):
            buf.append({'departure': i['departure'], 'path': i['path'], 'times': i['times']})
            if len(buf) == 100:
                db[dst].insert(buf)
                buf = []
    
        if len(buf) > 0:
            db[dst].insert(buf)
    
        src = dst

    # several aggregation types: aggregate each link based on the time the vehicle arrives at it, or
    # aggregate each vehicle's entire path at the time first arrives at a selected link, or aggregate paths 
    # by departure time.  Or by arrival at first selected
      
    data = {}
    interval = interval * 60   # minutes to seconds
    
    if agg == 'departure':
    
        for row in db[dst].find():
            ts = int(row['departure'] / interval)
            if ts not in data:
                data[ts] = {}
    
            for p in row['path']:
                if p not in data[ts]:
                    data[ts][p] = 1
                else:
                    data[ts][p] += 1

    elif agg == 'selected':
    
        for row in db[dst].find():
            for i in row['path']:
                if i in links:
                    break
    
            ts = int(row['times'][links.index(i)] / interval)
            if ts not in data:
                data[ts] = {}
        
            for p in row['path']:
                if p not in data[ts]:
                    data[ts][p] = 1
                else:
                    data[ts][p] += 1
    
    elif agg == 'path':
    
        for row in db[dst].find():
            t0 = int(row['departure'] / interval)
            t1 = int(row['times'][-1] / interval)
            for t in range(t0, t1+1):
                if t not in data:
                    data[t] = {}
    
                for p in row['path']:
                    if p not in data[t]:
                        data[t][p] = 1
                    else:
                        data[t][p] += 1

    elif agg == 'link':
        
        ll = list(db[dst].find())
        foo = len(ll)
        for row in ll:
            foo = foo - 1
            t0 = int(row['departure'] / interval)
            for i in range(len(row['path'])):
                link = row['path'][i]
                t1 =  int(row['times'][i] / interval)
                for t in range(t0, t1+1):
                    if t not in data:
                        data[t] = {}
                    if link not in data[t]:
                        data[t][link] = 1
                    else:
                        data[t][link] += 1
            t0 = t1
            
    else:
        return HttpResponse(simplejson.dumps({'status': 'Unknown aggregation type (%s)' %  agg}), mimetype='application/json')

    timestep_data = []
    maxv = 0       
    minv = 999999999
   
    if len(data.keys()) == 0:
        number_of_timesteps = 0
    else:
        number_of_timesteps = int(sorted(data.keys())[-1]) + 1

        for i in range(number_of_timesteps + 1):
            tstep = []
            if i in data:
                for j in data[i]:
                    v = data[i][j]
                    if v < minv: minv = v
                    if v > maxv: maxv = v
                    tstep.append({'linkid': j, 'value': data[i][j]})
            timestep_data.append(tstep)

    interval = interval / 60 # back to minutes
    r = {'status': 'OK', 'name': database, 'number_of_timesteps': number_of_timesteps, 'interval': interval, 'min': minv, 'max': maxv, 'timesteps': [i*interval for i in range(number_of_timesteps)], 'data': data}
    rjson = simplejson.dumps(r)
    return HttpResponse(rjson, mimetype='application/json')

def load_corridor_travel_times(request, database):
    try:
        db = attach_mongo(request, database)

        timestamps = sorted([r for r in db.busses.distinct('departure')])
        routes = list(db.busses.distinct('route'))
        
        paths = []
        for r in routes:
            a = db.busses.find_one({'route': r})
            paths.append(a['path'])
 
        m = 99999
        M = 0
        data = []
        for t in timestamps:
            tstep = {}
            for j in db.busses.find({'departure': t}):
                r = j['route']
                e = j['elapsed']
                if e < m: m = e
                if e > M: M = e
                tstep[r] = e
            data.append(tstep)
            
        # return minutes
        timestamps = [i/60.0 for i in timestamps]
    
        r = {'status': 'OK', 'name': database, 'data_range': (m,M), 'timestamps': timestamps, 'paths': paths, 'routes': routes, 'data': data}
        rjson = simplejson.dumps(r)
        return HttpResponse(rjson, mimetype='application/json')

    except:
        return HttpResponse(simplejson.dumps({'status': 'No such network as %s' %  database}), mimetype='application/json')

def load_OD_reached_nodes(request, database, given_origins, nodeids):

    try:
        db = attach_mongo(request, database)
        
        nodeids = [int(i) for i in nodeids.split(',')]
        
        reached = []
        if given_origins:
            for i in db.paths.find({'orig': {"$in": nodeids}}):
                if i['dest'] not in reached: reached.append(i['dest'])
        else:
            for i in db.paths.find({'dest': {"$in": nodeids}}):
                if i['orig'] not in reached: reached.append(i['orig'])

        r = {'status': 'OK', 'name': database, 'nodeids': reached}
        rjson = simplejson.dumps(r)
        return HttpResponse(rjson, mimetype='application/json')
    
    except:
        return HttpResponse(simplejson.dumps({'status': 'Unable to load reached nodes'}), mimetype='application/json')


def load_OD_paths(request, database, interval, aggregation, origins, destinations):
    
    interval = int(interval)
    
    try:
        db = attach_mongo(request, database)
        
        q = {"$and": [{'orig': {"$in": [int(i) for i in origins.split(',')]}},  {'dest': {"$in": [int(i) for i in destinations.split(',')]}}]}
        
        if aggregation == 'departure':
            m  = 'function() {'
            m +=   'var t = Math.floor(this.departure / %d);' % (interval * 60)
            m +=  'for (var i in this.path)'
            m +=       'emit({ts: t, id: this.path[i]}, 1);'
            m += '}'
        
        elif aggregation == 'path':
            m  = 'function() {'
            m +=   'var t0 = Math.floor(this.departure / %d);' % (interval * 60)
            m +=   'var t1 = Math.floor(this.arrival / %d);' % (interval * 60)
            m +=   'for (var t = t0; t <= t1; t++)'
            m +=      'for (var i in this.path)'
            m +=        'emit({ts: t, id: this.path[i]}, 1);'
            m += '}'
             
        elif aggregation == 'link':
            m  = 'function() {'
            m +=   'var t0 = this.departure / %d;' % (interval * 60)
            m +=   'for (var i = 0; i < this.path.length; i++) {'
            m +=      'if (i == (this.path.length-1)) t1 = this.arrival / %d;' % (interval * 60)
            m +=      'else t1 = this.times[i+1] / %d;' % (interval * 60)
            m +=      'for (var j = Math.floor(t0); j <= t1; j = j + 1)'
            m +=         'emit({ts: Math.floor(j), id: this.path[i]}, 1);'
            m +=      't0 = t1;'
            m +=   '}'
            m += '}'
        
        else:
            return HttpResponse(simplejson.dumps({'status': 'invalid aggregation: %s' % aggregation}), mimetype='application/json')
        
        r  = 'function(key, values) {'
        r +=   't = 0;'
        r +=   'for (var v in values) t = t + values[v];'
        r +=   'return (key, t);'
        r += '}'
        
        db.paths.map_reduce(Code(m), Code(r), 'blah', query=q)
        l = list(db.blah.find())
        
        nts = 0
        for i in l:
            ts = int(i['_id']['ts'])
            if ts > nts: nts = ts
        
        timestep_data = [[] for i in range(nts+1)]
        for i in l:
            ts = int(i['_id']['ts'])
            timestep_data[ts].append((int(i['_id']['id']), int(i['value'])))
        
        maxv = 0       
        for timestep in timestep_data:
            for l in timestep:
                if l[1] > maxv: maxv = l[1]
        
        r = {'status': 'OK', 'name': database, 'number_of_timesteps': nts, 'interval': interval, 'max': maxv, 'timesteps': [i*interval for i in range(nts+1)], 'data': timestep_data}
        
        rjson = simplejson.dumps(r)
        return HttpResponse(rjson, mimetype='application/json')
                       
    except:
        return HttpResponse(simplejson.dumps({'status': 'unable to query DB for OD paths'}), mimetype='application/json')
    
def load_reachtime(request, database, origins, interval, contour_levels, wndw, width, clip, elim_passed, artery):
    try:
        db = attach_mongo(request, database)
        
        # Given a set of origination node ids, get the actual coordinate points so we can find the centroid
        # to serve as the center of the departure points.  Interpret time values as minutes
        origin_nodes = eval('[' + origins + ']')
        contour_levels = [60*i for i in eval('[' + contour_levels + ']')]
        interval = int(interval) * 60
        width = int(width)
        artery = int(artery)
        
        if clip == 'true':
            clip = True
        else:
            clip = False
            
        if elim_passed == 'true':
            elim_passed = True
        else:
            elim_passed = False
            
        origin_coords = numpy.array([numpy.array(i['location']) for i in db.nodes.find({'id': {'$in': origin_nodes}})])
        centroid, radius = contour_tools.centroid(origin_coords)

        # Get all the paths that depart from any of the given origin nodes, sort them by departure time
        paths = sorted(list(db.paths.find({'orig': {'$in': origin_nodes}})), key=lambda a: a['departure'])
        
        # Divide them into intervals
        n_intervals = int((paths[-1]['departure'] - paths[0]['departure']) / interval) + 1

        # Create a dictionary mapping link ids to link endpoints
        links = []
        for p in paths:
            links += p['path']
                
        links = [int(i) for i in numpy.unique(numpy.array(links))]
        
        link_dict = {}
        for i in db.links.find({'id': {'$in': links}}):
            #link_dict[i['id']] = i['points']
            link_dict[i['id']] = [i['points'], i['capacity']]
            
        # Divide the paths into subsets depending on departure interval
        tstep_paths = [[] for i in range(n_intervals)]
        for p in paths:
            departure_interval = int((p['departure'] - paths[0]['departure']) / interval)
            tstep_paths[departure_interval].append(p)
            
        # For the set of paths that depart in each interval, we will be calculating a set of contour points for each contour level
        # For each contour of each interval, we maintain a dictionary that associates link ids with the path that is farthest along
        # that link
        timesteps = [{} for i in range(n_intervals)]
        
        for timestep_index, timestep, tpaths in zip(range(n_intervals), timesteps, tstep_paths):
               
            timestep['link_counts'] = {}
            timestep['contours'] = [{} for i in contour_levels]
            timestep['reached'] = {}
            timestep['contour_links'] = {}
            
            contours = timestep['contours']
             
            for p in tpaths:
                # If we are clipping the paths by the vicinity of the origin points, then
                # find the index of the last link that originates inside the vicinity; 0 otherwise
                
                if clip:
                    inside_flags = []
                    for linkid in p['path']:
                        link = link_dict[linkid]
                        
                        # link_origination_point = link[0]
                        # inside_flags.append(contour_tools.inside_circle(centroid, radius, link_origination_point))
                        
                        if link[1] >= artery:
                            link_origination_point = link[0][0]
                            inside_flags.append(contour_tools.inside_circle(centroid, radius, link_origination_point))
                        
                    for start_indx in range(len(inside_flags)-1, -1, -1):
                        if inside_flags[start_indx]:
                            break
                else:
                    start_indx = 0
                
                # Now iterate along the path links, looking for the links where the vehicle passes the 
                # designated time time contour levels
                # If desired, wait for first link that lies outside clip circle
                
                t_departure = p['times'][start_indx]
                elapsed = [t - t_departure for t in p['times'][start_indx:]]
                
                if len(elapsed) > 1:
                    c = 0
                    for ts, te, link in zip(elapsed[:-1], elapsed[1:], p['path'][start_indx:]):
                           
                        link = int(link)
                            
                        # Keep track of how many times this link has been visited
                        if link not in timestep['link_counts']:
                            timestep['link_counts'][link] = 1
                        else:
                            timestep['link_counts'][link] += 1  
                            
                        # OK, we've gotten to this link at the current contour level, so we mark
                        # it 'reached' IF this is the earliest we got to it
                        if (link not in timestep['reached']) or (timestep['reached'][link] > c):
                            timestep['reached'][link] = c 

                        # And this link should show up in the earliest set of contour links
                        if (link not in timestep['contour_links']) or (timestep['contour_links'][link] > c):
                            timestep['contour_links'][link] = c 
                          
                        # Note - If there's a contour point in this link, then we'll need to queue up all
                        # the contour points on this link - hence the 'while'.  
                        if te >= contour_levels[c]:
                            while c < len(contour_levels) and te >= contour_levels[c]:
        
                                contour = contours[c]
                                
                                # The current link is a hit
                                if 'contour_intersection_links' not in contour:
                                    contour['contour_intersection_links'] = {}
                                
                                d = (contour_levels[c] - ts) / (te - ts)
                                
                                if link not in contour['contour_intersection_links'] or d > contour['contour_intersection_links'][link]: 
                                    contour['contour_intersection_links'][link] = d
                                    
                                # Bump to next contour level
                                c = c + 1
                       
                            # Might have run off the end of the sought contour list
                            if c == len(contour_levels):
                                break
                                                                                                                                 
 
        # Now figure actual contour intersection locations
        for timestep_index, timestep in enumerate(timesteps):
        
            if 'contours' in timestep:
                for i, contour in enumerate(timestep['contours']):
                    
                    if len(contour) > 0: 
                        contour['points'] = []
                        contour['linkids'] = []
                                 
                        for linkid in contour['contour_intersection_links']:
                           
                            # We are looking at contour i.  If this link shows up in the 'passed' list
                            # at this or a greater contour level, indicating that this link was completely
                            # traversed by a different path at this level and so we ignore any contour
                            # points generated by this path   

                            if (not elim_passed) or ((linkid not in timestep['reached']) or (timestep['reached'][linkid] <= i)):
                                d = contour['contour_intersection_links'][linkid]
                                # link_endpoints = link_dict[linkid]
                                # p0 = link_endpoints[0]
                                # p1 = link_endpoints[1]
                                # point = [p0[0] + d*(p1[0] - p0[0]), p0[1] + d*(p1[1] - p0[1])]
                                # contour['points'].append(point)
                                # contour['linkids'].append(linkid)
                                link = link_dict[linkid]
                                if link[1] >= artery:
                                    p0 = link[0][0]
                                    p1 = link[0][1]
                                    point = [p0[0] + d*(p1[0] - p0[0]), p0[1] + d*(p1[1] - p0[1])]
                                    contour['points'].append(point)
                                    contour['linkids'].append(linkid)

                        del contour['contour_intersection_links']
                                           
                # Now we have the points where the paths cross the time boundaries
                # Next we figure out a smooth contour polygon.  
                tmp = None
                for i, contour in enumerate(timestep['contours']):
                        
                    if 'points' in contour and len(contour['points']) > 2:
                        # resample each radial set onto [-180,180] by 1
                        radially_sorted_points = contour_tools.radial_sort(contour['points'], centroid)
                        
                        x = [rsp[0] for rsp in radially_sorted_points]
                        y = [rsp[1] for rsp in radially_sorted_points]
                        
                        x = [xx-360 for xx in x] + x + [xx+360 for xx in x]
                        y = y + y + y
                        
                        linterp = interp1d(x, y)
                        
                        bearing = numpy.linspace(-180,180,361)
                        radii = list(linterp(bearing))
                        
                        if tmp != None:
                            for j in range(len(radii)):
                                if radii[j] < tmp[j]: 
                                    radii[j] = tmp[j]
                                
                        tmp = radii
                    
                        smoothed = contour_tools.fltr(radii, wndw, width)
                        
                        poly = []
                        for i in range(0, 365, 5):
                            poly.append(contour_tools.move(centroid, i-180, smoothed[i]))
                        
                        poly += [poly[0]]
                        
                        contour['polygon'] = poly    
                
                    
        max_count = -1
        for timestep in timesteps:
            if 'link_counts' in timestep:
                link_data = timestep['link_counts']
                for linkid in link_data:
                    if link_data[linkid] > max_count: 
                        max_count = link_data[linkid]
        
        interval = interval / 60;
        
        r = {'status': 'OK', 'name': database, 'contour_levels': contour_levels, 'centroid': centroid, 'radius': radius, 'interval': interval, 'max': max_count, 'timesteps': [i*interval for i in range(len(timesteps))], 'data': timesteps}
        rjson = simplejson.dumps(r)
        return HttpResponse(rjson, mimetype='application/json')
    except:
        return HttpResponse(simplejson.dumps({'status': 'error evaluating contours'}), mimetype='application/json')

def load_weighted_average(request, network, network2, weighted_values, volumes, aggregation, result_name):

    try:
        vu = VisUser.objects.get(user=request.user.username)
        calc = Calc(host=MONGO_HOST, network=network, user=vu.user, pw=vu.dbpw)
    except:
        print sys.exc_info()
        return HttpResponse(simplejson.dumps({'status': 'error accessing database'}), mimetype='application/json')

    try:
        wdata = calc.Execute('%s:%s.sum(%s)' % (network, weighted_values, aggregation))
        vols = calc.Execute('%s:%s.sum(%s)' % (network, volumes, aggregation))
        
        #Avoid divide-by-zero
        wdata.data[vols.data == 0] = 0
        vols.data[vols.data == 0] = 1
        
        data = (wdata.data / vols.data)
         
        if network2 != 'none':
            wdata = calc.Execute('%s:%s.sum(%s)' % (network2, weighted_values, aggregation))
            vols = calc.Execute('%s:%s.sum(%s)' % (network2, volumes, aggregation))
            
            #Avoid divide-by-zero
            wdata.data[vols.data == 0] = 0
            vols.data[vols.data == 0] = 1
            
            data = data - (wdata.data / vols.data)
            
        data = data.tolist()
         
        rjson = simplejson.dumps({'status': 'OK', 'attribute': {result_name: {'units': wdata.units, 'timesteps': list(wdata.timesteps), 'ids': list(wdata.linkids), 'data': data}}})
        return HttpResponse(rjson, mimetype='application/json')
    except:
        return HttpResponse(simplejson.dumps({'status': 'error evaluating expression'}), mimetype='application/json')
 
def load_data(request, network, varname, units, varstring):
                  
    try:
        vu = VisUser.objects.get(user=request.user.username)
        calc = Calc(host=MONGO_HOST, network=network, user=vu.user, pw=vu.dbpw)
    except:
        print sys.exc_info()
        return HttpResponse(simplejson.dumps({'status': 'error accessing database'}), mimetype='application/json')

    try:
        tmp = varstring.replace('DIVIDEBY', '/')
        tdd = calc.Execute(tmp)
        data = tdd.data.tolist()
        rjson = simplejson.dumps({'status': 'OK', 'attribute': {varname: {'units': units, 'timesteps': list(tdd.timesteps), 'ids': list(tdd.linkids), 'data': data}}})
        return HttpResponse(rjson, mimetype='application/json')
    except:
        return HttpResponse(simplejson.dumps({'status': 'error evaluating expression'}), mimetype='application/json')

def load_network(request, database):
            
    try:
        db = attach_mongo(request, database)
        network = Network(db)
    except:
        return HttpResponse(simplejson.dumps({'status': 'error loading network'}), mimetype='application/json')
   
     
    stoplist = []
    for s in network.stops:
        stoplist.append([s.node, s.trip, s.attributes])
        
    seglist = []
    for s in network.segments:
        seglist.append([s.link, s.trip, s.attributes])
        
    nodelist = []
    for n in network.nodes:
        nodelist.append([n.nid, n.ntype, n.point, n.stops])
  
    idlist  = []
    linklist    = []    
    linkattrvalues  = []
    for i in network.linkattrs:
        linkattrvalues.append([])

    for l in network.links:
        idlist.append(l.lid)
        linklist.append([l.lid, l.ltype, l.src, l.dst, l.path, l.segments])
        for i,a in enumerate(linkattrvalues):
            a.append(l.attributes[i])

    linkattributes = {}
    for i,attrname in enumerate(network.linkattrs):
        if attrname == 'length':
            attrname = 'len'
        linkattributes[attrname] = {'timesteps': [0], 'ids': idlist, 'units': network.linkattrunits[i], 'data': [linkattrvalues[i]]}

    busroutes = {}
    for bid in network.busroutes:
        br = network.busroutes[bid].split(',')
        busroutes[bid] = [int(a) for a in br]
    
    result = {
        'status': 'OK',
        'name': database,
        'stops': stoplist, 'stopAttributes': network.stopattrs, 'stopAttrUnits': network.stopattrunits,
        'segments': seglist, 'segAttributes': network.segattrs, 'segAttrUnits': network.segattrunits,
        'nodes': nodelist, 'nodeTypes': network.nodetypes.split(','), 'nodeAttributes': {}, 
        'links': linklist, 'linkTypes': network.linktypes.split(','), 'linkAttributes': linkattributes, 
        'busroutes': busroutes,
        'routes': network.routes,
        'trips': network.trips
    }
              
    s = simplejson.dumps(result)

    return HttpResponse(s, mimetype='application/json')

def delete_database(request, database):
    return HttpResponseRedirect('error - no deleting networks!') 

def visualize(request, database): 
    user = request.user.username

    vu = VisUser.objects.get(user=user)
    mdb = pymongo.MongoClient(MONGO_HOST)
    mdb['admin'].authenticate(vu.user, vu.dbpw)
 
    database_list = [];
    for i in mdb.database_names():
        if i[:len(user)] == user:
            database_list.append(i)
    
    return render(request, 'visualize.html', {'database': database, 'database_list': database_list})

def network_error(request, errormsg):    
    return render(request, 'database_open_error.html', {"errormsg": errormsg})

def network_ok(request):
    return render(request, 'database_open_ok.html')

def transit(request, database, routes, start, end, directions, with_feeders):

    try:
        db = attach_mongo(request, database)
    except:
        return HttpResponse(simplejson.dumps({'status': 'error loading network'}), mimetype='application/json')
    

    # The following creates a query that looks for all
    # passengers that meet the start/end range and travel on
    # any of the selected routes in the selected directions
    routes = [int(i) for i in routes.split(',')]
    dirs  = [int(i) for i in directions.split(',')]
    
    routeids = []
    for r in routes:
        if dirs[0] == 1:
            routeids.append(int(r))
        if dirs[1] == 1:
            routeids.append(-int(r))

    ands = [{'departure': {'$gte': float(start)}},
            {'arrival': {'$lte': float(end)}},
            {'routes': {'$elemMatch': {'$in': routeids}}}]
    
    selected_passengers = list(db.passengers.find({'$and': ands}))

    # Find the trips the selected passengers took - 
    # all of them if with_feeders, otherwise 
    # only the trips they took on the selected routes)

    all_tripids = []
    route_tripids = []

    for i in selected_passengers:
      all_tripids += i['trips']
      for j,k in zip(i['routes'], i['trips']):
        if j in routeids:
          route_tripids.append(k)

    if int(with_feeders) == 1:
      selected_tripids = list(set(all_tripids))
    else:
      selected_tripids = list(set(route_tripids))

    # Create a table to look up trips by id
    trips = {}
    for i in db.trips.find({'trip': {'$in': all_tripids}}):
        trips[i['trip']] = i

    # The following accumulate the number of selected passengers
    # boarding and alighting at each node, and travelling on each link

    selected_segment_ids = []
    selected_link_ids    = []
    selected_stop_ids    = []
    selected_node_ids    = []

    feeder_link_ids      = []

    selected_trips       = []

    for p in selected_passengers:
      for t,b,a in zip(p['trips'], p['brdnodes'], p['altnodes']):
        ib = trips[t]['nodes'].index(b)  # index of boarding 
        ia = trips[t]['nodes'].index(a)  # index of alighting

        if t in selected_tripids:
          selected_node_ids    += trips[t]['nodes'][ib:ia+1]
          selected_stop_ids    += trips[t]['stops'][ib:ia+1]
          selected_link_ids    += trips[t]['links'][ib:ia]
          selected_segment_ids += trips[t]['segments'][ib:ia]
        else:
          feeder_link_ids      += trips[t]['links'][ib:ia]

    selected_stop_ids    = list(set(selected_stop_ids))
    selected_segment_ids = list(set(selected_segment_ids))

    selected_stops = list(db.stops.find({'stopid': {'$in': selected_stop_ids}}))

    node_attrs = ['load', 'boarding', 'alighting', 'dwell']
    tmp = {}
    for stop in selected_stops:
      lid = stop['nodeid']
      if lid not in tmp:
        tmp[lid] = {'knt': 0}
        for a in node_attrs:
          tmp[lid][a+'_tot'] = 0
          tmp[lid][a+'_max'] = 0
          tmp[lid][a+'_min'] = 99999999
      accum = tmp[lid]
      accum['knt'] += 1
      for j in node_attrs:
        accum[j+'_tot'] = accum[j+'_tot'] + stop[j]
        if accum[j+'_max'] < stop[j]: accum[j+'_max'] = stop[j]
        if accum[j+'_min'] > stop[j]: accum[j+'_min'] = stop[j]

    node_attr_data = {'nodeids': tmp.keys()}
    for i in node_attrs:
      node_attr_data[i] = {}
      for j in ['tot', 'min', 'max']:
        node_attr_data[i][j] = [tmp[k][i+'_'+j] for k in node_attr_data['nodeids']]
      node_attr_data[i]['avg'] = [tmp[k][i+'_tot'] / float(tmp[k]['knt']) for k in node_attr_data['nodeids']]

    selected_segments = list(db.segments.find({'segmentid': {'$in': selected_segment_ids}}))

    link_attrs = ['load', 'elapsed']

    tmp = {}
    for segment in selected_segments:
      lid = segment['linkid']
      if lid not in tmp:
        tmp[lid] = {'knt': 0}
        for a in link_attrs:
          tmp[lid][a+'_tot'] = 0
          tmp[lid][a+'_max'] = 0
          tmp[lid][a+'_min'] = 99999999
      accum = tmp[lid]
      accum['knt'] += 1
      for j in link_attrs:
        accum[j+'_tot'] = accum[j+'_tot'] + segment[j]
        if accum[j+'_max'] < segment[j]: accum[j+'_max'] = segment[j]
        if accum[j+'_min'] > segment[j]: accum[j+'_min'] = segment[j]


    link_attr_data = {'linkids': tmp.keys()}
    for i in link_attrs:
      link_attr_data[i] = {}
      for j in ['tot', 'min', 'max']:
        link_attr_data[i][j] = [tmp[k][i+'_'+j] for k in link_attr_data['linkids']]
      link_attr_data[i]['avg'] = [tmp[k][i+'_tot'] / float(tmp[k]['knt']) for k in link_attr_data['linkids']]

    result = {
        'link_attrs': link_attrs,
        'node_attrs': node_attrs,
        'link_attr_data': link_attr_data,
        'node_attr_data': node_attr_data,
        'feed_links': list(set(feeder_link_ids)),
        'status': 'OK'
    }
              
    s = simplejson.dumps(result)

    return HttpResponse(s, mimetype='application/json')

def transitOD(request, database, aggregation, start, end, origins, destinations):
             
    try:
        db = attach_mongo(request, database)
    except:
        return HttpResponse(simplejson.dumps({'status': 'error loading network'}), mimetype='application/json')
    
    c = db.stops.find()
    stop2node = [-1]*c.count()
    for i in c:  
        stop2node[i['stopid']] = i['nodeid']
    
    c = db.segments.find()
    segment2link = [-1]*c.count()
    for i in c:  
        segment2link[i['segmentid']] = i['linkid']
    
    ands = []
    ands.append({aggregation: {'$gte': int(start)}})
    ands.append({aggregation: {'$lte': int(end)}})
    ands.append({'origin': {'$in': [int(i[1:]) for i in origins.split(',')]}})              # note - delete the '-'
    ands.append({'destination': {'$in': [int(i[1:]) for i in destinations.split(',')]}})    #note - delete the '-'
    passengers = list(db.passengers.find({'$and': ands}))
    
    origins = {}
    destinations = {}
    links = {}
    walks = []
    for p in passengers:
 
        for i in [p['walkto'], p['walkfrom']] + p['transfers']:
            if i not in walks: walks.append(i)
            
        origin = -p['origin']    # note - add the '-' back in
        if origins.has_key(origin):
            origins[origin] = origins[origin] + 1
        else:
            origins[origin] = 1
            
        destination = -p['destination']    # note - add the '-' back in
        if destinations.has_key(destination):
            destinations[destination] = destinations[destination] + 1
        else:
            destinations[destination] = 1
            
        for i,trip_id in enumerate([j for j in p['trips']]):
            trip = db.trips.find_one({'trip': trip_id})
            tnodes = [stop2node[j] for j in trip['stops']]
            b = p['brdnodes'][i]
            a = p['altnodes'][i]
            for j in range(tnodes.index(b), tnodes.index(a)):
                link = segment2link[trip['segments'][j]]
                if links.has_key(link):
                    links[link] = links[link] + 1
                else:
                    links[link] = 1

    result = {
        'status': 'OK',
        'links': links,
        'origins': origins,
        'destinations': destinations,
        'walks': walks
    }
              
    s = simplejson.dumps(result)

    return HttpResponse(s, mimetype='application/json')
