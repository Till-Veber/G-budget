from app import db
from flask_login import UserMixin
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import uuid


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    surname = db.Column(db.String(50), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    patronymic = db.Column(db.String(50))
    login = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='Участник')
    reg_date = db.Column(db.Date, default=datetime.utcnow)
    family_id = db.Column(db.Integer, db.ForeignKey('family.id'), nullable=True)

    transactions = db.relationship('Transaction', backref='author', lazy='dynamic', foreign_keys='Transaction.user_id')
    user_plans = db.relationship('UserPlan', backref='owner', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Family(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.Date, default=datetime.utcnow)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'))

    members = db.relationship('User', backref='family', lazy='dynamic', foreign_keys='User.family_id')
    categories = db.relationship('Category', backref='family', lazy='dynamic', cascade='all, delete-orphan')
    invitations = db.relationship('Invitation', backref='family', lazy='dynamic', cascade='all, delete-orphan')
    family_plans = db.relationship('FamilyPlan', backref='family', lazy='dynamic', cascade='all, delete-orphan')


class Invitation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey('family.id'), nullable=False)
    code = db.Column(db.String(36), unique=True, default=lambda: uuid.uuid4().hex[:12])
    status = db.Column(db.String(20), default='Ожидает')
    expires_at = db.Column(db.DateTime, default=lambda: datetime.utcnow() + timedelta(days=7))


class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey('family.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=True)
    type = db.Column(db.String(10), default='Расход')
    color = db.Column(db.String(7), default='#6c757d')
    is_protected = db.Column(db.Boolean, default=False)

    children = db.relationship('Category', backref=db.backref('parent', remote_side=[id]), lazy='dynamic')
    transactions = db.relationship('Transaction', backref='category', lazy='dynamic', cascade='all, delete-orphan')


class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    time = db.Column(db.Time, nullable=False, default=lambda: datetime.utcnow().time())
    comment = db.Column(db.String(255))


class FamilyPlan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    family_id = db.Column(db.Integer, db.ForeignKey('family.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    limit_amount = db.Column(db.Numeric(10, 2), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)


class UserPlan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    limit_amount = db.Column(db.Numeric(10, 2), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)