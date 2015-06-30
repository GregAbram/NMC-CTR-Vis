import sys, pdb
import numpy as np
from TDD import TDD
from VDB import VDB
from pyparsing import Literal, Word, Forward, oneOf, Group, alphas, Optional, Combine, delimitedList, operatorPrecedence, Regex, Suppress, alphanums, OneOrMore, opAssoc

class CalcError(Exception):

	def __init__(self, value):
		self.value = value

	def __str__(self):
		return repr(self.value)

class Atom:
	seq			= 0

	def __init__(self):
		print 'superclass init'
		self.seq = Atom.seq
		Atom.seq += 1

	def __str__(self):
		return 'Atom superclass'

	def __repr__(self):
		return self.__str__()

	def Dump(self, indent):
		print indent, self.seq, 'Atom superclass'

	def Evaluate(self, vdb, vardict):
		raise CalcError('Cannot evaluate superclass')
				
class Value(Atom):

	def __init__(self, c):
		self.value = float(c[0])

	def __str__(self):
		return 'VALUE %f' % self.value

	def Dump(self, indent):
		print indent, 'VALUE', self.value

	def Evaluate(self, vdb, vardict):
		return self.value

class DBvar(Atom):

	def __init__(self, base_network, c):

		if len(c[0]) == 2:
			if c[0][0] == '.':
				self.database = base_network
			else:
				self.database = c[0][0]
			self.table	= c[0][1]
			self.operator = 'none'
			self.interval = 0
			self.varname = '%s:%s' % (self.database, self.table)
		elif len(c[0]) == 3:
			self.database = base_network
			self.table	= c[0][0]
			self.operator = c[0][1]
			self.interval = int(c[0][2].value)
			self.varname = '%s.%s(%d)' % (self.table, self.operator, self.interval)
		elif len(c[0]) == 4:
			if c[0][0] == '.':
				self.database = base_network
			else:
				self.database = c[0][0]
			self.table	= c[0][1]
			self.operator = c[0][2]
			self.interval = int(c[0][3].value)
			self.varname = '%s:%s.%s(%d)' % (self.database, self.table, self.operator, self.interval)

	def __str__(self):
		return ('DBVAR %s:%s.%s(%s)' % (self.database, self.table, self.operator, self.interval))

	def Dump(self, indent):
		print '%s:%s.%s(%s)' % (self.database, self.table, self.operator, self.interval)

	def Evaluate(self, vdb, vardict):
		if self.table in ['capacity', 'lanes', 'speed', 'length', 'model_length']:
			if self.operator != 'none' or self.interval != 0:
				raise CalcError('error fetching %s with aggregation %s(%d)' % (self.table, self.operator, self.interval))
			return vdb.linkdetails(self)
		else:
			return vdb.pull(self)

class Name(Atom):

	def __init__(self, c):
		self.name = c[0]

	def __str__(self):
		return 'NAME ' + self.name

	def Dump(self, indent):
		print self.name

	def Evaluate(self, vdb, vardict):
		if self.name in vardict:
			return vardict[self.name]
		else:
			raise CalcError('undefined variable: ' + self.name)

class Operator(Atom):
	
	def __init__(self, c):
		self.left		 = c[0][0]
		self.operator = c[0][1]
		self.right		= c[0][2]

	def __str__(self):
		return 'OPERATOR ' + self.operator

	def Dump(self, indent):
		print self.operator
		self.left.Dump(indent + '		')
		self.right.Dump(indent + '		')

	def Evaluate(self, vdb, vardict):
		right = self.right.Evaluate(vdb, vardict)

		if self.operator == '=':
			if self.left.__class__ != Name:
				raise CalcError('illegal LHS')
			vardict[self.left.name] = right
			result = right

		else:
			left = self.left.Evaluate(vdb, vardict)
	
			if left.__class__.__name__ == 'TDD' or right.__class__.__name__ == 'TDD':
	
				if left.__class__.__name__ == 'TDD' and right.__class__.__name__ == 'TDD':
	
					if (left.data.shape[0] != right.data.shape[0]) and (left.data.shape[0] != 1 and right.data.shape[0] != 1):
						raise CalcError('mismatched length error: %d %d' % (left.data.shape[0], right.data.shape[0]))
			
					if list(left.linkids) == list(right.linkids):
						linkids = left.linkids
						ldata = left.data
						rdata = right.data
					else:
						common = [i for i in list(left.linkids) if i in list(right.linkids)]
						
						left_columns = [list(left.linkids).index(i) for i in common]
						right_columns = [list(right.linkids).index(i) for i in common]
						
						linkids = np.array(left.linkids)[left_columns].tolist()
						tmp     = np.array(right.linkids)[right_columns].tolist()
						if linkids != tmp:
							raise CalcError('mismatched linkids')
							
						ldata = left.data[:,left_columns]
						rdata = right.data[:,right_columns]
			
					if left.delta_t == -1:
						delta_t = right.delta_t
						timesteps = right.timesteps
					else:
						delta_t = left.delta_t
						timesteps = left.timesteps
						
					if self.operator == '+':
						result = TDD(delta_t, linkids, timesteps, ldata + rdata)
					elif self.operator == '-':
						result = TDD(delta_t, linkids, timesteps, ldata - rdata)
					elif self.operator == '*':
						result = TDD(delta_t, linkids, timesteps, ldata * rdata)
					else:
						result = TDD(delta_t, linkids, timesteps, ldata / rdata)
			
				elif left.__class__.__name__ == 'TDD':
	
					if self.operator == '+':
						result = TDD(left.delta_t, left.linkids, left.timesteps, left.data + right)
					elif self.operator == '-':
						result = TDD(left.delta_t, left.linkids, left.timesteps, left.data - right)
					elif self.operator == '*':
						result = TDD(left.delta_t, left.linkids, left.timesteps, left.data * right)
					else:
						result = TDD(left.delta_t, left.linkids, left.timesteps, left.data / right)
			
				else:
	
					if self.operator == '+':
						result = TDD(right.delta_t, right.linkids, right.timesteps, left + right.data)
					elif self.operator == '-':
						result = TDD(right.delta_t, right.linkids, right.timesteps, left - right.data)
					elif self.operator == '*':
						result = TDD(right.delta_t, right.linkids, right.timesteps, left * right.data)
					else:
						result = TDD(right.delta_t, right.linkids, right.timesteps, left / right.data)
			
				result.data = np.where(False == np.isfinite(result.data), 0, result.data)
				
			else:
				if self.operator == '+':
					result = left + right
				elif self.operator == '-':
					result = left - right
				elif self.operator == '*':
					result = left * right
				else:
					if right == 0:
						result = 0
					else:
						result = left / right
						
		return result

class FuncCall(Atom):

	def __init__(self, c):
		self.name				= c[0][0]
		self.arguments = c[0][1]

	def __str__(self):
		return 'FUNCCALL ' + self.name

	def Dump(self, indent):
		print self.name
		for arg in self.arguments:
			arg.Dump(indent + '		')

	def Evaluate(self, vdb, vardict):
		if self.name == 'abs':

			if len(self.arguments) != 1:
				raise CalcError('abs takes one argument (%d given)' % len(self.arguments))

			arg = self.arguments[0].Evaluate(vdb, vardict)

			if arg.__class__.__name__ == 'TDD':
				return TDD(arg.delta_t, arg.linkids, arg.timesteps, abs(arg.data))
			else:
				return abs(arg)

		elif self.name == 'min':

			if len(self.arguments) != 2:
				raise CalcError('min takes two arguments (%d given)' % len(self.arguments))

			a = self.arguments[0].Evaluate(vdb, vardict)
			b = self.arguments[1].Evaluate(vdb, vardict)

			if a.__class__.__name__ == 'TDD' and b.__class__.__name__ == 'TDD':
				return TDD(a.delta_t, a.linkids, a.timesteps, np.minimum(a.data, b.data))
			elif a.__class__.__name__ == 'TDD':
				return TDD(a.delta_t, a.linkids, a.timesteps, np.minimum(a.data, b))
			elif b.__class__.__name__ == 'TDD':
				return TDD(b.delta_t, b.linkids, b.timesteps, np.minimum(a, b.data))
			else:
				return numpy.minimum(arg)

		elif self.name == 'max':

			if len(self.arguments) != 2:
				raise CalcError('max takes two arguments (%d given)' % len(self.arguments))

			a = self.arguments[0].Evaluate(vdb, vardict)
			b = self.arguments[1].Evaluate(vdb, vardict)

			if a.__class__.__name__ == 'TDD' and b.__class__.__name__ == 'TDD':
				return TDD(a.delta_t, a.linkids, a.timesteps, np.maximum(a.data, b.data))
			elif a.__class__.__name__ == 'TDD':
				return TDD(a.delta_t, a.linkids, a.timesteps, np.maximum(a.data, b))
			elif b.__class__.__name__ == 'TDD':
				return TDD(b.delta_t, b.linkids, b.timesteps, np.maximum(a, b.data))
			else:
				return numpy.maximum(arg)

		elif self.name == 'print':
			for i in self.arguments:
				self.arguments[i].Evaluate(vdb, vardict).Dump()

		elif self.name == 'push':

			data = self.arguments[0].Evaluate(vdb, vardict)

			if data.__class__.__name__ != 'TDD':
				raise CalcError('Can only push TDD data')

			if self.arguments[1].__class__.__name__ != 'DBvar':
				raise CalcError('invalid name for pushed variable')

			vdb.push(data, self.arguments[1])

		else:
			raise CalcError('unrecognized function call: ' + self.name)
				

class SignOp(Atom):

	def __init__(self, c):
		self.sign			 = c[0]
		self.argument = c[1]

	def __str__(self):
		return 'SIGNOP ' + self.op

	def Dump(self, indent):
		print self.op

	def Evaluate(self, vdb, vardict):
		arg = self.left.Evaluate(vdb, vardict)
		if self.sign == '-':
			if arg.__class__.__name__ == 'TDD':
				return TDD(arg.delta_t, arg.linkids, arg.timesteps, 0 - arg.data)
			else:
				return -arg
		else:
			return arg

class Calc:

	def __init__(self, host, network, user, pw):
		self.network = network
		self.vdb = VDB(host, user, pw)
		self.vardict = {}

		self.expr = Forward()

		LPAR,RPAR,dot = map(Suppress, '().')
		integer = Regex(r"-?\d+").setParseAction(Value)
		real = Regex(r"-?\d+\.\d*").setParseAction(Value)

		word = Word(alphas+"_.", alphanums+"_")

		function_call = Group(word("name").setResultsName("name") + LPAR + Group(Optional(delimitedList(self.expr))) + RPAR).setParseAction(lambda a,b,c: FuncCall(c))

		dbvar = Group(word + Literal(":").suppress() + Word(alphas+"_", alphanums+"_") + Optional(dot.suppress() + word + LPAR + integer + RPAR)).setParseAction(lambda a,b,c: DBvar(self.network, c))

		variable = Word(alphas+"_", alphanums+"_").setParseAction(lambda a,b,c: Name(c))

		operand = ( function_call | dbvar | real | integer | variable )
		expop = Literal('^')
		signop = oneOf('+ -')
		multop = oneOf('* /')
		plusop = oneOf('+ -')
		assop = Literal('=')

		self.expr <<= operatorPrecedence( operand,
			[(expop, 2, opAssoc.RIGHT, lambda a,b,c: Operator(c)),
			 (signop, 1, opAssoc.RIGHT, lambda a,b,c: Operator(c)),
			 (multop, 2, opAssoc.LEFT, lambda a,b,c: Operator(c)),
			 (plusop, 2, opAssoc.LEFT, lambda a,b,c: Operator(c)),
			 (assop, 2, opAssoc.LEFT, lambda a,b,c: Operator(c))]
		)

	def Execute(self, pgm):

		sys.stderr.write('Execute: %s\n' % pgm)
		
		r = ""
		for expr in pgm.split(';'):
			
			try:
				sys.stderr.write('evaluating expression: %s ...\n' % expr)
				for parsed in self.expr.scanString(expr):
					r = parsed[0][0].Evaluate(self.vdb, self.vardict)
			except:
				sys.stderr.write('error !!\n')
				raise
			
		return r
