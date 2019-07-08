use std::any::Any;
use std::collections::HashMap;

pub enum AllOrList<T> {
    All,
    List(Vec<T>),
}

impl<T> AllOrList<T> {
    fn push(&mut self, v: T) {
        match self {
            AllOrList::All => {
                *self = AllOrList::List(vec![v]);
            }
            AllOrList::List(l) => {
                l.push(v);
            }
        }
    }
}

impl<T> Default for AllOrList<T> {
    fn default() -> Self {
        AllOrList::All
    }
}

pub type Field = AllOrList<String>;
pub type PredicateFunction = Fn(HashMap<String, &Any>) -> bool;
pub type Predicate = AllOrList<Box<PredicateFunction>>;

pub struct Scope {
    provider: String,
    path: String,
    predicates: Predicate,
    fields: Field,
}

impl Scope {
    pub fn new(provider: String, path: String) -> Scope {
        Scope {
            provider: provider,
            path: path,
            predicates: Default::default(),
            fields: Default::default(),
        }
    }

    pub fn add_filter(mut self, predicate: Box<PredicateFunction>) -> Scope {
        self.predicates.push(predicate);
        self
    }

    pub fn add_field(mut self, field: String) -> Scope {
        self.fields.push(field);
        self
    }
}
