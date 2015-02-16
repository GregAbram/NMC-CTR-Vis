import pycurl
import threading

class fetcher:

  @staticmethod
  def fetcher_thread(self, filename, url, auth):
    f = open(filename, 'wb')
    c = pycurl.Curl()
    c.setopt(pycurl.URL, url)
    c.setopt(c.USERPWD, auth)
    c.setopt(c.WRITEDATA, f)
    c.setopt(c.FAILONERROR, True)
    try:
      c.perform()
    except:
      self.status = 1
    else:
      self.status = 2
    c.close()
    f.close()

  def __init__(self, filename, url, auth):
    self.status = 0
    self.t = threading.Thread(target=self.fetcher_thread, args=(self, filename, url, auth))
    self.t.start()

  def wait(self):
    print 'waiting'
    self.t.join()
    print 'done... status %d' % self.status
