# from django.conf.urls import patterns, include, url
from django.conf.urls import include, url
import os, sys, pdb
from django.contrib import admin
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
#from django.utils import simplejson
import json as simplejson
from django.template import RequestContext
from django.http import HttpResponseRedirect
from django.contrib.auth.models import User
from django.contrib import admin
from django.db import models
from visualizer.models import VisUser
from django.core.exceptions import ObjectDoesNotExist

admin.autodiscover()

def nmc_login(request):

    if request.POST:

        username = request.POST['username']
        password = request.POST['password']

        user = authenticate(username=username, password=password)

        if user is not None:
            if user.is_active:
                login(request, user)
                try:
                    vu = VisUser.objects.get(user=user)
                except ObjectDoesNotExist:
                    vu = VisUser(user=user, dbpw=password)
                    vu.save()
                return render(request, 'welcome.html', {'state': 'success', 'username': ''})
            else:
                return render(request, 'auth.html', {'state': 'inactive account', 'username': ''})
        else:
            return render(request, 'auth.html', {'state': 'bad username/password', 'username': ''})
            state = 'bad username/password'

    return render(request, 'auth.html', {'state': 'login: ', 'username': ''})


urlpatterns = [
    url(r'^$', nmc_login),
    url(r'^visualizer/', include('visualizer.urls')),
    url(r'^admin/doc/', include('django.contrib.admindocs.urls')),
    url(r'^admin/', include(admin.site.urls)),
]
