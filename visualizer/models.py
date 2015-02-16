from django.db import models

class VisUser(models.Model):
    user = models.CharField(max_length=40, unique=True)
    dbpw = models.CharField(max_length=40)
    