use crate::hir::def_collector::dc_crate::CompilationError;
use crate::hir::resolution::errors::ResolverError;
use crate::tests::get_program_errors;

use super::assert_no_errors;

#[test]
fn trait_inheritance() {
    let src = r#"
        pub trait Foo {
            fn foo(self) -> Field;
        }

        pub trait Bar {
            fn bar(self) -> Field;
        }

        pub trait Baz: Foo + Bar {
            fn baz(self) -> Field;
        }

        pub fn foo<T>(baz: T) -> (Field, Field, Field) where T: Baz {
            (baz.foo(), baz.bar(), baz.baz())
        }

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_inheritance_with_generics() {
    let src = r#"
        trait Foo<T> {
            fn foo(self) -> T;
        }

        trait Bar<U>: Foo<U> {
            fn bar(self);
        }

        pub fn foo<T>(x: T) -> i32 where T: Bar<i32> {
            x.foo()
        }

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_inheritance_with_generics_2() {
    let src = r#"
        pub trait Foo<T> {
            fn foo(self) -> T;
        }

        pub trait Bar<T, U>: Foo<T> {
            fn bar(self) -> (T, U);
        }

        pub fn foo<T>(x: T) -> i32 where T: Bar<i32, i32> {
            x.foo()
        }

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_inheritance_with_generics_3() {
    let src = r#"
        trait Foo<A> {}

        trait Bar<B>: Foo<B> {}

        impl Foo<i32> for () {}

        impl Bar<i32> for () {}

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_inheritance_with_generics_4() {
    let src = r#"
        trait Foo { type A; }

        trait Bar<B>: Foo<A = B> {}

        impl Foo for () { type A = i32; }

        impl Bar<i32> for () {}

        fn main() {}
    "#;
    assert_no_errors(src);
}

#[test]
fn trait_inheritance_dependency_cycle() {
    let src = r#"
        trait Foo: Bar {}
        trait Bar: Foo {}
        fn main() {}
    "#;
    let errors = get_program_errors(src);
    assert_eq!(errors.len(), 1);

    assert!(matches!(
        errors[0].0,
        CompilationError::ResolverError(ResolverError::DependencyCycle { .. })
    ));
}

#[test]
fn trait_inheritance_missing_parent_implementation() {
    let src = r#"
        pub trait Foo {}

        pub trait Bar: Foo {}

        pub struct Struct {}

        impl Bar for Struct {}

        fn main() {
            let _ = Struct {}; // silence Struct never constructed warning
        }
    "#;
    let errors = get_program_errors(src);
    assert_eq!(errors.len(), 1);

    let CompilationError::ResolverError(ResolverError::TraitNotImplemented {
        impl_trait,
        missing_trait: the_trait,
        type_missing_trait: typ,
        ..
    }) = &errors[0].0
    else {
        panic!("Expected a TraitNotImplemented error, got {:?}", &errors[0].0);
    };

    assert_eq!(the_trait, "Foo");
    assert_eq!(typ, "Struct");
    assert_eq!(impl_trait, "Bar");
}
